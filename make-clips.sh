#!/bin/bash
#
# make-clips.sh
#
# Compresses phone video for the website, makes a poster image for each
# clip, and prints the HTML blocks to paste into climbing.html.
#
# Usage:
#     chmod +x make-clips.sh
#     ./make-clips.sh
#
# Needs ffmpeg. On macOS:  brew install ffmpeg
#
# -----------------------------------------------------------------------------
# Settings. Change these if you want.
# -----------------------------------------------------------------------------

# Where your original videos are.
IN_DIR="/Users/astrotkh/Desktop/dist/vids"

# Where the compressed clips and posters are written. This must match the
# paths inside climbing.html, which expect a folder called "videos".
OUT_DIR="/Users/astrotkh/Desktop/dist/videos"

# Height of the output in pixels. The width follows automatically.
# 720 is plenty for a web page. Use 480 if you want smaller files still.
HEIGHT=720

# Quality. Lower number means better picture and a bigger file.
# 23 is near-transparent, 28 is a good web compromise, 32 is visibly soft.
CRF=28

# Seconds into the clip to grab the poster frame from.
POSTER_AT=1

# -----------------------------------------------------------------------------

set -e   # stop on the first error

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed."
  echo "On macOS run:  brew install ffmpeg"
  exit 1
fi

if [ ! -d "$IN_DIR" ]; then
  echo "Input folder not found: $IN_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo ""
echo "Reading from : $IN_DIR"
echo "Writing to   : $OUT_DIR"
echo ""

# -----------------------------------------------------------------------------
# Collect the input files.
#
# The -print0 / read -d '' pairing is what makes filenames with spaces or
# brackets safe, such as VID_20261021_153841(1).mp4. Without it the shell
# would split that name apart.
# -----------------------------------------------------------------------------

FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find "$IN_DIR" -maxdepth 1 -type f \
           \( -iname "*.mov" -o -iname "*.mp4" -o -iname "*.m4v" -o -iname "*.avi" \) \
           -print0 | sort -z)

COUNT=${#FILES[@]}

if [ "$COUNT" -eq 0 ]; then
  echo "No video files found in $IN_DIR"
  exit 1
fi

echo "Found $COUNT video files."
echo ""

# -----------------------------------------------------------------------------
# Pass 1: compress each clip and grab its poster frame.
# -----------------------------------------------------------------------------

TOTAL_IN=0
TOTAL_OUT=0

# These arrays are filled now and used to write the HTML in pass 2.
OUT_NAMES=()
ORIENTATIONS=()
SOURCE_NAMES=()

INDEX=0
for SRC in "${FILES[@]}"; do
  INDEX=$((INDEX + 1))

  # Zero-padded number, so clip-02 sorts before clip-10 in the folder.
  NUM=$(printf "%02d" "$INDEX")
  NAME="clip-$NUM"

  OUT_MP4="$OUT_DIR/$NAME.mp4"
  OUT_JPG="$OUT_DIR/$NAME.jpg"

  BASENAME=$(basename "$SRC")
  echo "[$INDEX/$COUNT] $BASENAME  ->  $NAME.mp4"

  # -vf scale=-2:$HEIGHT   resize to HEIGHT tall, width chosen automatically
  #                        and forced to an even number, which H.264 requires
  # -c:v libx264           the codec every browser can play
  # -crf $CRF              quality setting, see above
  # -preset slow           spend more time compressing for a smaller file
  # -pix_fmt yuv420p       the colour format Safari and older players need
  # -an                    drop the audio, which a climbing clip does not need
  # -movflags +faststart   put the index at the front so playback can begin
  #                        before the whole file has downloaded
  ffmpeg -nostdin -hide_banner -loglevel error -y \
    -i "$SRC" \
    -vf "scale=-2:$HEIGHT" \
    -c:v libx264 -crf "$CRF" -preset slow -pix_fmt yuv420p \
    -an \
    -movflags +faststart \
    "$OUT_MP4"

  # Poster frame. If the clip is shorter than POSTER_AT seconds, fall back
  # to the very first frame instead of failing.
  if ! ffmpeg -nostdin -hide_banner -loglevel error -y \
         -ss "$POSTER_AT" -i "$OUT_MP4" -vframes 1 -q:v 4 "$OUT_JPG" 2>/dev/null; then
    ffmpeg -nostdin -hide_banner -loglevel error -y \
      -i "$OUT_MP4" -vframes 1 -q:v 4 "$OUT_JPG"
  fi
  if [ ! -s "$OUT_JPG" ]; then
    ffmpeg -nostdin -hide_banner -loglevel error -y \
      -i "$OUT_MP4" -vframes 1 -q:v 4 "$OUT_JPG"
  fi

  # Work out whether the finished clip is portrait or landscape. We measure
  # the OUTPUT, not the input, because phone videos carry rotation metadata
  # that ffmpeg applies during the conversion.
  W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$OUT_MP4")
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$OUT_MP4")

  if [ "$W" -gt "$H" ]; then
    ORIENT="wide"
  else
    ORIENT="tall"
  fi

  SIZE_IN=$(wc -c < "$SRC")
  SIZE_OUT=$(wc -c < "$OUT_MP4")
  TOTAL_IN=$((TOTAL_IN + SIZE_IN))
  TOTAL_OUT=$((TOTAL_OUT + SIZE_OUT))

  # One decimal place, using integer maths so this works on any shell.
  MB_IN=$((SIZE_IN * 10 / 1048576))
  MB_OUT=$((SIZE_OUT * 10 / 1048576))
  echo "          ${W}x${H} ${ORIENT}   $((MB_IN / 10)).$((MB_IN % 10)) MB -> $((MB_OUT / 10)).$((MB_OUT % 10)) MB"

  OUT_NAMES+=("$NAME")
  ORIENTATIONS+=("$ORIENT")
  SOURCE_NAMES+=("$BASENAME")
done

# -----------------------------------------------------------------------------
# Pass 2: write the HTML blocks to a file and show the mapping.
# -----------------------------------------------------------------------------

HTML_OUT="$(dirname "$OUT_DIR")/paste-into-climbing.txt"
: > "$HTML_OUT"

i=0
while [ "$i" -lt "$COUNT" ]; do
  NAME="${OUT_NAMES[$i]}"
  ORIENT="${ORIENTATIONS[$i]}"
  SRCNAME="${SOURCE_NAMES[$i]}"

  if [ "$ORIENT" = "wide" ]; then
    CLASS="clip clip--wide"
  else
    CLASS="clip"
  fi

  {
    echo "    <!-- from $SRCNAME -->"
    echo "    <figure class=\"$CLASS\">"
    echo "      <video controls preload=\"metadata\" playsinline poster=\"videos/$NAME.jpg\">"
    echo "        <source src=\"videos/$NAME.mp4\" type=\"video/mp4\">"
    echo "        Your browser cannot play this video."
    echo "        <a href=\"videos/$NAME.mp4\">Download it instead.</a>"
    echo "      </video>"
    echo "      <figcaption>Caption goes here.</figcaption>"
    echo "    </figure>"
    echo ""
  } >> "$HTML_OUT"

  i=$((i + 1))
done

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

TOTAL_IN_MB=$((TOTAL_IN / 1048576))
TOTAL_OUT_MB=$((TOTAL_OUT / 1048576))
TOTAL_IN_D=$((TOTAL_IN * 10 / 1048576))
TOTAL_OUT_D=$((TOTAL_OUT * 10 / 1048576))

echo ""
echo "-------------------------------------------------------------"
echo "Done. $COUNT clips."
echo "Total size: $((TOTAL_IN_D / 10)).$((TOTAL_IN_D % 10)) MB  ->  $((TOTAL_OUT_D / 10)).$((TOTAL_OUT_D % 10)) MB"
echo ""
echo "HTML blocks written to:"
echo "  $HTML_OUT"
echo ""
echo "Open that file, copy everything in it, and paste it inside the"
echo "<div class=\"clips\"> ... </div> in climbing.html, replacing the three"
echo "example blocks that are there now. Then write the captions."
echo ""

if [ "$TOTAL_OUT_MB" -gt 300 ]; then
  echo "NOTE: ${TOTAL_OUT_MB} MB is a lot to put in a GitHub repository."
  echo "      Raise CRF to 32 at the top of this script and run it again,"
  echo "      or drop HEIGHT to 480, or publish fewer clips."
  echo ""
fi