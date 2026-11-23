# Engineering notes

The decisions that shaped this project, and why I made them.

1. **A procedural scene, no model files.** Every object is built from Three.js geometry (lathe,
   tube, rounded boxes), and covers, cloth, wood and the garden are painted into canvases at load
   time. The download stays small and every visual detail lives in readable code.

2. **Painting textures in a Web Worker.** Canvas painting runs in an `OffscreenCanvas` worker,
   with a main-thread fallback, so the page stays responsive while dozens of textures are
   generated.

3. **A tight draw-call budget.** Shelf books are one instanced mesh per bookcase, static parts are
   merged, the glass is the only transmissive material and the pixel ratio is capped at 2. A
   frame stays around 180 draw calls and 130k triangles, inside budgets of 250 and 200k.

4. **Compiling every material at start-up.** Shaders for parts that only appear later (an open
   book's pages, for example) are compiled before the first interaction, so opening a book never
   stalls.

5. **Real HTML on the 3D pages.** An open book lands flat and square to the camera, so each page
   projects to an exact rectangle; I position transparent HTML pages on those rectangles. The two
   reading pages are rendered unlit in exactly the CSS paper colour, so the text and the 3D paper
   never drift apart, and the text stays selectable and accessible.

6. **Data-driven books.** Each section is plain data. Its spine thickness comes from how much text
   it holds, and its cover motif is a few lines of data on a shared 5×5 grid, so a new section
   needs no artwork.

7. **One open/close controller.** Opening and closing are built from fresh tweens rather than a
   reversed timeline, so a book can close from any state, including halfway open. The scene
   publishes its state as `data-scene-state` on `<html>`; CSS and the test scripts read it instead
   of guessing timings.

8. **Accessibility without a parallel UI.** Real `<button>`s sit over the projected bounds of each
   object, giving Tab, arrow keys, Enter and screen-reader names. There's a Contents menu,
   reduced motion swaps the 3D opening for a fade to a paper page, and without WebGL the site
   becomes a plain list of sections. Contrast is measured against the rendered pixels
   (`npm run check:contrast`), not assumed.

9. **A Worker with KV and a cron for live data.** The reading list and playlist come from a
   Cloudflare Worker. A cron refreshes them every six hours into Workers KV and requests read only
   KV, so one slow upstream never slows a visitor down, and the free plan's write limit is never
   close.

10. **Spotify through the owner's refresh token.** Spotify only lists a playlist's tracks to its
    owner, so the Worker uses the Authorization Code flow with a refresh token stored as a Worker
    secret. The hour-long access token is cached in KV until five minutes before it expires, and a
    401 drops it and retries once.

11. **Graceful fallbacks at every layer.** If Goodreads or Spotify fails, the Worker keeps the last
    good data and marks it stale. If the Worker is slow or unreachable, the site keeps the
    reading list and playlist it was built with (covers and a track snapshot are committed). Live
    data swaps in at the same card size, so nothing jumps.

12. **Treating the Worker's data as untrusted.** It relays third-party content, so the browser
    accepts only `https` links and images and inserts text with `textContent`.

13. **Build-time assets, no third-party requests.** Book covers, playlist art and responsive photo
    sizes (AVIF and WebP) are prepared before each build, so visitors only load files from this
    site plus Google Fonts.

14. **Fonts off the critical path.** The cover fonts are only needed to paint textures, so they
    load separately and subset to the characters they draw; they never block first paint.

15. **Checks that run headless.** Playwright drives the production build with software WebGL to
    take screenshots of every state, measure draw calls and run Lighthouse, so all of it works
    on a machine without a GPU.
