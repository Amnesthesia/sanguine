# Splash-to-app transition: options

Prototype of three ways to go from the splash (PLAN.md §9.9, `apps/mobile/src/features/splash/BrandSplash.tsx`) into the app. In each one the lock-up becomes a crescent moon, then the app is revealed through the crescent's bowl. The three share the same zoom and differ in how the logo becomes the moon. Made on 2026-11-23 for the owner to choose from. The owner chose the flip first; it is in the app (`BrandSplash.tsx`, `crescent.ts`, D-154, P8-37). The owner then skipped the morph; it stays a prototype only.

The owner allowed retracing the client's emblem and logotype for this (2026-11-23), an exception to D-049's "never redraw" recorded in D-154. In dark mode the crescent is moonlight yellow (#F4D27A) (owner, 2026-11-23); in light mode it is ink. In the morph, the dark lines blend from blush to yellow as they bend.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The prototype: the three options side by side, playing in a loop, with play/pause, a time scrubber, speed and light/dark. Serve the repo over HTTP and open it (see "Refresh" below); a `file://` page cannot load `data.js`. `?only=morph&t=1.2&scheme=dark` shows one phone frozen at one time. |
| `trace.py` | Retraces `docs/brand-v2/emblem.png` and `logotype.png` with potrace, fits the crescent, and writes `data.js`, `emblem-traced.svg` and `trace-check.png`. |
| `data.js` | Generated. The retraced outlines placed exactly where the splash draws the lock-up (260 pt wide, centred on a 393×852 pt screen), each point's bent position on the large crescent, and the crescent's two circles. |
| `emblem-traced.svg` | Generated. The retraced lock-up (emblem over logotype) as smooth white outlines, 780 px wide like `splash-lockup.png`. |
| `trace-check.png` | Generated. The original PNGs in grey with the retraced outlines in red over them, and the large crescent in blue, to check the retrace. |
| `render.mjs` | Renders `frames/` from `index.html`. |
| `frames/` | Generated PNGs, 786×1704 (2× of 393×852). |

## Frames

`frames/contact-sheet-light.png` puts the nine moments of each option side by side (light). Each frame is also its own file, named `<option>-<scheme>-<n>-<moment>.png`:

| Moment | Shows |
| --- | --- |
| `1-hold` | The splash as it is today: lock-up, rule and tagline. |
| `2-change-25`, `3-change-50`, `4-change-75` | A quarter, half and three quarters of the way through the logo becoming the moon. The tagline has faded out by then. |
| `5-moon` | The solid crescent, just before the zoom. |
| `6-zoom-25`, `7-zoom-50`, `8-zoom-75` | The zoom: the crescent's bite opens onto the app, then everything scales up about the bite's centre, as if flying through it. |
| `9-app` | The app (the Today screen) once the zoom has passed. |

Options (`<option>`):

- `morph`: the whole lock-up curls into the crescent, sweeping left to right. Left to right on the lock-up becomes horn to horn; top to bottom becomes the bite's edge to the moon's outer edge, so the emblem lands on the inner edge and the script on the outer. The outlines thicken a little as they bend so they stay visible, and the solid moon fades in at the end. The first frame is the exact splash PNG, and it hands over to the retraced outlines in 0.12 s.
- `fade`: the lock-up fades and settles back (scale 0.94) while the crescent fades in and settles forward (0.9 to 1).
- `flip`: the lock-up narrows to a vertical line, like a card turned edge-on, and the crescent widens out of it. This is a 2D squeeze (`scaleX`), as in the app: a 3D rotation was clipped by the full-screen layers beneath it on iOS (D-154).

Light has all nine moments per option. Dark (`-dark-`) has `1-hold`, `3-change-50`, `5-moon` and `7-zoom-50`.

## Timings in the prototype

Hold 0.9 s (shortened: the app holds the tagline for 3.5 s), tagline out 0.35 s, logo to moon 1.5 s (morph), 0.75 s (fade) or 0.8 s (flip), a 0.25 s pause on the moon, zoom 0.85 s. The app underneath scales from 1.1 to 1 during the zoom.

## Known gaps

- The client's emblem has two faint, half-transparent strokes in the middle. The retrace keeps only ink above 50% alpha, so they are missing from the outlines. Only the morph shows the outlines, and only after the 0.12 s hand-over from the PNG.
- The large crescent is the emblem's own crescent, fitted with two circles and scaled up (its moon radius becomes 78 pt), centred on the screen like the lock-up. It keeps the emblem's tilt. `apps/mobile/src/features/splash/crescent.ts` holds the same circles; keep them in step if `trace.py` changes.
- The app frame is a static App Store screenshot (`docs/screenshots/appstore/ios/01-today-*.png`), not the live app.
- Reduce Motion is not shown. In the app it would keep today's cross-fade.

## Refresh

```bash
brew install potrace   # once
python3 docs/design/splash-transition/trace.py
node docs/design/splash-transition/render.mjs
```

`render.mjs` needs Playwright with Chromium (`npx playwright install chromium`) and runs its own static server. To view the prototype in a browser: `python3 -m http.server 8765` from the repo root, then open `http://localhost:8765/docs/design/splash-transition/index.html`.
