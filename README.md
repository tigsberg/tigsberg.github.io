# tigran-site

Personal academic website. Plain HTML, CSS and JavaScript, no build step and no
dependencies. Open `index.html` in a browser and it runs.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole site: about, research, papers, teaching, code, contact. |
| `style.css` | All the styling. Colours are defined once at the top. |
| `site.js` | Draws the warped disc in the hero. |
| `portrait.jpg` | Photograph in the About section. Currently a placeholder. |
| `favicon.svg` | Browser tab icon. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Putting it on GitHub Pages

1. Create a new repository on GitHub.
   - To get `https://<username>.github.io`, name the repository
     `<username>.github.io`.
   - Any other name gives `https://<username>.github.io/<repo-name>/`.
2. Upload these files to the repository root, either by dragging them into the
   web interface or with git:

   ```bash
   git init
   git add .
   git commit -m "Site"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```

3. In the repository, go to **Settings → Pages**, set **Source** to
   *Deploy from a branch*, choose branch `main` and folder `/ (root)`, and save.
4. Wait a minute or two. The URL appears at the top of that same settings page.

To update the site later, edit the files and push again. Pages redeploys on its
own.

## Things to fill in

Search `index.html` for these:

- `cv.pdf` — the hero links to this. Drop your CV into the repository root with
  that filename, or change the link.
- `Repository` and `Documentation` under **Code** both point at `#`. Replace
  with the POGONA links.
- `ORCID` and `GitHub` under **Contact** both point at `#`.

## The portrait

`portrait.jpg` ships as a placeholder, a warped disc drawn in the site's own
colours, so the About section looks finished before you add a photograph. To use a
real one, replace that file keeping the same name. A portrait-orientation image
works best; it is cropped to 4:5 and around 900 by 1125 pixels is plenty.

If you would rather keep the abstract placeholder, nothing needs doing. The
image has an `alt` attribute set to your name, so change that in `index.html` if
you change what the picture shows.

To put a caption under the photograph, add a line inside the `<figure>`:

```html
<figcaption>Shanghai, 2026</figcaption>
```

## Adding a paper

Copy any `<li class="pub">` block in the Papers section and edit it. New papers
go at the top of the list. Wrap your own surname in `<b>` so it stands out, and
add `pub--first` to the `class` when you are first author:

```html
<li class="pub pub--first">
  <span class="pub__year">2027</span>
  <div class="pub__body">
    <h3 class="pub__title">Title of the paper</h3>
    <p class="pub__meta">
      <b>Khachaturyants</b>, Someone, Someone else
      &middot; <i>Journal name</i> 123, 456
    </p>
  </div>
</li>
```

## Changing the colours

Everything comes from the block at the top of `style.css`:

```css
--paper:    #fcfcfd;   /* page background     */
--ink:      #0f1c2e;   /* body text           */
--midplane: #b9c2cd;   /* rules and hairlines */
--up:       #bf3b2e;   /* above the midplane  */
--down:     #2f5e9e;   /* below the midplane  */
```

`site.js` reads `--up`, `--down` and `--midplane` from the stylesheet, so the
hero figure follows any change you make there.

## The hero figure

`site.js` builds a warped disc and draws it edge-on. Each star sits at a radius
`R` and azimuth `PHI`, and the warp lifts it out of the midplane by
`z = W(R) * sin(PHI - phase)`, where `W(R)` is zero inside `R_WARP` and grows
outwards. Advancing `phase` makes the warp precess.

### Turning it

The figure responds to the visitor:

- **Drag left and right** pushes the warp's phase forward or back, precessing it
  by hand.
- **Drag up and down** tilts the disc away from edge-on, up to about 35 degrees.
- **Arrow keys** do the same once the figure has keyboard focus.
- **Let go** and both offsets ease back to zero over about a second. The
  automatic precession keeps running underneath throughout, so the figure
  rejoins the path it would have been on rather than snapping to where it
  started.

On touch screens only horizontal drags are captured. Vertical swipes scroll the
page as usual, which is handled by `touch-action: pan-y` on the canvas.

### Parameters

Named constants near the top of `site.js`:

```js
var N_STARS = 1300;    // how many points
var R_SCALE = 0.52;    // exponential scale length
var R_WARP  = 0.30;    // warp starts outside this radius
var A_WARP  = 0.85;    // warp amplitude at the disc edge
var PRECESS = 0.00022; // precession rate

var DRAG_PHASE = 0.010; // radians of phase per pixel dragged sideways
var DRAG_TILT  = 0.006; // radians of tilt per pixel dragged vertically
var TILT_LIMIT = 0.62;  // about 35 degrees
var EASE_MS    = 1100;  // how long it takes to settle back
```

Set `A_WARP` to `0` for a flat disc. Set `TILT_LIMIT` to `0` to disable tilting
and keep it strictly edge-on.

For visitors whose system asks for reduced motion the automatic precession does
not run at all and the disc holds a fixed phase, but dragging and the arrow keys
still work, because that motion answers something the visitor did.
