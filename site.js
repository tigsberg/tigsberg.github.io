/* ============================================================
   Hero figure: a warped galactic disc you can turn.

   Each point is a star at galactocentric radius R and azimuth
   PHI. The warp lifts it out of the midplane by

       z = W(R) * sin(PHI - phase)

   where W(R) is zero inside R_WARP and grows outwards, so one
   side of the disc rides up and the other dips down: the
   "integral sign" shape seen in the Milky Way.

   `phase` advances on its own, which makes the warp precess.
   That is the effect that constrains the shape of the dark
   matter halo.

   Interaction
   -----------
   Drag left and right  : push the warp's phase forward or back,
                          i.e. precess it by hand.
   Drag up and down     : tilt the disc away from edge-on.
   Arrow keys           : the same, for keyboard users.
   Let go               : both offsets ease back to zero, so the
                          figure rejoins the precession path it
                          would have been on anyway.

   On touch screens only horizontal drags are captured, so
   vertical swipes still scroll the page.
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.getElementById("warp");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");

  // Colours come from the stylesheet so there is one source of truth.
  var css      = getComputedStyle(document.documentElement);
  var COLOR_UP = css.getPropertyValue("--up").trim()       || "#bf3b2e";
  var COLOR_DN = css.getPropertyValue("--down").trim()     || "#2f5e9e";
  var COLOR_MP = css.getPropertyValue("--midplane").trim() || "#b9c2cd";

  /* ---- Model parameters ------------------------------------ */
  var N_STARS = 20000;    // point count
  var R_DISC  = 1.0;     // disc edge, in model units
  var R_SCALE = 0.52;    // exponential scale length
  var R_WARP  = 0.30;    // warp starts outside this radius
  var A_WARP  = 0.85;    // warp amplitude at the disc edge
  var H_THIN  = 0.022;   // disc thickness at the centre
  var H_FLARE = 0.090;   // extra thickness at the edge
  var PRECESS = 0.00022; // radians per millisecond; kept slow

  /* ---- Interaction parameters ------------------------------ */
  var DRAG_PHASE = 0.010;  // radians of phase per pixel dragged sideways
  var DRAG_TILT  = 0.006;  // radians of tilt  per pixel dragged vertically
  var TILT_LIMIT = 0.62;   // about 35 degrees, so it stays near edge-on
  var EASE_MS    = 1100;   // how long the figure takes to settle back
  var KEY_PHASE  = 0.22;   // radians per arrow-key press
  var KEY_TILT   = 0.12;

  /* ---- Build the star list once ---------------------------- */
  /* Positions are fixed. Only the phase and the tilt change, so
     the points move together rather than jittering. */
  var stars = [];
  var i, R, u;

  for (i = 0; i < N_STARS; i++) {
    do {
      u = Math.random();
      R = -R_SCALE * Math.log(1 - u);   // exponential radial profile
    } while (R > R_DISC);

    stars.push({
      R: R,
      phi: Math.random() * Math.PI * 2,
      jitter: gaussian() * (H_THIN + H_FLARE * Math.pow(R / R_DISC, 2)),
      size: 0.75 + Math.random() * 0.85
    });
  }

  // Box-Muller, for normally distributed disc thickness.
  function gaussian() {
    var a = 1 - Math.random();
    var b = Math.random();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }

  // Warp amplitude as a function of radius: flat inside R_WARP.
  function warpAmplitude(r) {
    if (r <= R_WARP) return 0;
    var t = (r - R_WARP) / (R_DISC - R_WARP);
    return A_WARP * Math.pow(t, 1.6);
  }

  // Blend two hex colours. t = 0 gives c1, t = 1 gives c2.
  function mix(c1, c2, t) {
    var r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    var r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return "rgb(" + Math.round(r1 + (r2 - r1) * t) + ","
                  + Math.round(g1 + (g2 - g1) * t) + ","
                  + Math.round(b1 + (b2 - b1) * t) + ")";
  }

  /* ---- Canvas sizing, with device pixel ratio --------------- */
  var W = 0, H = 0;

  function resize() {
    var dpr  = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- Draw one frame --------------------------------------
     `phase` is the warp phase. `incl` is the viewing inclination
     in radians: 0 is edge-on.

     Disc coordinates are X = R cos(PHI), Y = R sin(PHI), Z = z.
     Tilting rotates about the X axis:

         screen x = X
         screen y = Z cos(incl) + Y sin(incl)
         depth    = Y cos(incl) - Z sin(incl)
     ----------------------------------------------------------- */
  function draw(phase, incl) {
    ctx.clearRect(0, 0, W, H);

    var cosI = Math.cos(incl);
    var sinI = Math.sin(incl);

    var cx = W / 2;
    var cy = H / 2;
    var sx = (W / 2) * 0.93;
    var sy = (H / 2) * 0.88;

    // The midplane itself, drawn first and kept faint. It tilts with
    // the disc, so the whole figure reads as one object.
    ctx.strokeStyle = COLOR_MP;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 0; k <= 48; k++) {
      var ang = (k / 48) * Math.PI * 2;
      var mx = cx + (R_DISC * Math.cos(ang)) * sx;
      var my = cy - (R_DISC * Math.sin(ang) * sinI) * sy;
      if (k === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    var s, X, Y, Z, px, py, depth, alpha, colour, zNorm;

    for (i = 0; i < stars.length; i++) {
      s = stars[i];

      Z = warpAmplitude(s.R) * Math.sin(s.phi - phase) + s.jitter;
      X = s.R * Math.cos(s.phi);
      Y = s.R * Math.sin(s.phi);

      px = cx + X * sx;
      py = cy - (Z * cosI + Y * sinI) * sy;

      // How far along the line of sight, 0 near and 1 far.
      depth = Math.min(1, Math.abs(Y * cosI - Z * sinI) / R_DISC);

      alpha = 0.38 + 0.52 * (1 - depth);
      zNorm = Math.max(-1, Math.min(1, Z / A_WARP));

      // Colour by true height above the midplane, not by screen
      // position, so the meaning survives tilting.
      if (zNorm >= 0) {
        colour = mix(COLOR_MP, COLOR_UP, Math.min(1, zNorm * 3.2));
      } else {
        colour = mix(COLOR_MP, COLOR_DN, Math.min(1, -zNorm * 3.2));
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(px, py, s.size * (1.35 - 0.45 * depth), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /* ---- State ------------------------------------------------ */
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var startTime   = null;  // when the automatic precession began
  var offsetPhase = 0;     // how far the viewer has pushed the phase
  var offsetTilt  = 0;     // how far the viewer has tilted the disc

  var dragging    = false;
  var lastX       = 0;
  var lastY       = 0;
  var allowTilt   = true;  // false for touch, so the page can still scroll

  // Set when the viewer lets go, so the offsets can ease back to zero.
  var easeFrom    = null;  // { phase, tilt, at }

  function basePhase(now) {
    if (reduced) return Math.PI / 2;        // a fixed, clear phase
    if (startTime === null) startTime = now;
    return (now - startTime) * PRECESS;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function settle(now) {
    if (!easeFrom) return;
    var t = (now - easeFrom.at) / EASE_MS;
    if (t >= 1) {
      offsetPhase = 0;
      offsetTilt  = 0;
      easeFrom    = null;
      return;
    }
    var k = 1 - easeOutCubic(t);
    offsetPhase = easeFrom.phase * k;
    offsetTilt  = easeFrom.tilt  * k;
  }

  function frame(now) {
    settle(now);
    draw(basePhase(now) + offsetPhase, offsetTilt);
    requestAnimationFrame(frame);
  }

  function releaseToPath() {
    easeFrom = { phase: offsetPhase, tilt: offsetTilt, at: performance.now() };
  }

  /* ---- Pointer interaction ---------------------------------- */
  canvas.addEventListener("pointerdown", function (e) {
    dragging  = true;
    easeFrom  = null;                       // cancel any settling in progress
    allowTilt = e.pointerType !== "touch";  // vertical touch drags scroll
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    offsetPhase += (e.clientX - lastX) * DRAG_PHASE;
    if (allowTilt) {
      offsetTilt += (e.clientY - lastY) * DRAG_TILT;
      offsetTilt = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, offsetTilt));
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("is-dragging");
    if (e && e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    releaseToPath();
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);

  /* ---- Keyboard interaction --------------------------------- */
  canvas.addEventListener("keydown", function (e) {
    var handled = true;
    easeFrom = null;

    if (e.key === "ArrowLeft")       offsetPhase -= KEY_PHASE;
    else if (e.key === "ArrowRight") offsetPhase += KEY_PHASE;
    else if (e.key === "ArrowUp")    offsetTilt  -= KEY_TILT;
    else if (e.key === "ArrowDown")  offsetTilt  += KEY_TILT;
    else handled = false;

    if (!handled) return;
    e.preventDefault();
    offsetTilt = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, offsetTilt));

    // Settle back a moment after the last key press.
    clearTimeout(canvas._keyTimer);
    canvas._keyTimer = setTimeout(releaseToPath, 450);
  });

  canvas.addEventListener("blur", function () {
    if (offsetPhase || offsetTilt) releaseToPath();
  });

  /* ---- Run -------------------------------------------------- */
  resize();
  requestAnimationFrame(frame);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

})();
