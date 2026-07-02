# Media popup → MediaWindow: open & focus clicked image

## Context

The `.info-window` media popup (created by `MediaLibraryPlugin` via `InfoWindow('mediapopup')`) lists image thumbnails for a verse. Clicking one currently opens the raw image in a **new browser tab** (`<a href target="_blank">`). Instead, a click should open/focus that exact image inside the **MediaWindow** gallery — switching it to the right chapter if needed, and opening a MediaWindow if none exists.

Scope: image popups only. Video/JFM popups play inline in the popup, have no item list, and stay as-is.

## Files to modify

1. `browserbible/js/plugins/MediaLibraryPlugin.js` — popup rendering + click handling
2. `browserbible/js/windows/MediaWindow.js` — gallery item identity + `selectMediaItem()`
3. `browserbible/js/core/WindowManager.js` — small `activate(id)` helper

## Changes

### 1. MediaLibraryPlugin.js

- **`showImagePopup` (line 41)**: pass `verseid` and `sectionid` in from the click handler in `setupMediaEvents` (line 128–147; `verseid` is already computed there; get `sectionid` from `icon.closest('.section')?.getAttribute('data-id')` — more robust than `verseid.split('_')[0]` and guaranteed to match the later DOM lookup). Keep the `<a href>` (modifier-click still opens the raw image) and add identity data attributes to each anchor: `data-folder`, `data-filename`, `data-verseid`, `data-sectionid`.
- **Delegated click handler** on `mediaPopup.body`, attached once at plugin init:
  - scope to `e.target.closest('.inline-image-library-thumbs a')` so video popups are never affected;
  - bail on `e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0` (preserve open-in-new-tab);
  - otherwise `e.preventDefault()`, `mediaPopup.hide()`, then `openInMediaWindow(select)` with `select = { sectionid, verseid, folder, filename }`.
- **`openInMediaWindow(select)`** (import `getApp` from `../core/registry.js`):
  ```js
  const wm = getApp()?.windowManager;
  if (!wm) return;
  const mediaWin = wm.getWindows().find(w => w.className === 'MediaWindow');
  if (mediaWin) {
    mediaWin.controller?.selectMediaItem?.(select);
    wm.activate(mediaWin.id);
  } else {
    wm.add('MediaWindow', { select });  // Window ctor self-activates; no activate() needed
  }
  ```
  A direct controller call (not a `globalmessage` broadcast, not a synthetic `'message'` trigger) is deliberate: it's an explicit targeted action, works on **unlinked** MediaWindows (App.js:199 only broadcasts to linked ones), and avoids the drop-race where a just-created controller hasn't attached its `'message'` subscriber yet (connectedCallback is async, BaseWindow.js:71–83). `selectMediaItem`'s own not-ready guard (below) makes the call safe at any lifecycle point.

### 2. MediaWindow.js

- **`createGalleryItem` (line 503)**: add `folder: mediaLibrary.folder`, `filename: mediaInfo.filename`, and `verseid` (pass `verseid` through from `renderVerseInto`, line 459, which already has it).
- **Extract `setFilter(type, enabled)`**: sets `state.filters[type]`, toggles the button's `active` class, clears `currentSectionId` (defeats the early-return at line 320), calls `processContent()`. Use it from the existing filter-button handler (line 113–121) and from the retry below.
- **New `selectMediaItem({ sectionid, verseid, folder, filename })`** — the single public entry point:
  1. If `this.mediaLibraries` is not loaded yet (also covers a not-yet-initialized component), stash as `this.pendingSelect` and return.
  2. If `this.state.currentSectionId !== sectionid`: set `this.contentToProcess = document.querySelector('.section[data-id="${sectionid}"]')` and `processContent()` (same DOM-lookup path `handleMessage` uses for `nav`, line 186).
  3. Find the gallery index with a match ladder: exact `folder`+`filename` → same `folder` + filename with the `-color` suffix stripped (the gallery skips `-color` variants at line 474 but the popup shows them) → first item with same `verseid` → give up gracefully (thumbs stay rendered, no gallery opened).
  4. If nothing matched and `!this.state.filters.art`: `setFilter('art', true)` and retry the ladder once.
  5. `showGalleryItem(index)`, then scroll the selected thumb into view: `.media-library-thumbs a.selected` → `scrollIntoView({ block: 'nearest' })`.
- **`init` (line 154)**, inside the `getMediaLibraries` callback: `const select = this.pendingSelect ?? this.initData?.select` (initData is assigned before `appendChild`, WindowManager.js:100/103, so it's available here). If `select` and the section exists in the DOM → `selectMediaItem(select)`; otherwise keep the existing `contentToProcess` / `requestCurrentContent()` logic (fallback prevents a permanently blank new window if the section vanished). Clear `pendingSelect` after consuming.
- `getData()` intentionally does not persist `select` — the focus request is transient.

### 3. WindowManager.js

- **New `activate(id)` method**: find the window by id (guard unknown ids), remove `active` from all `.window, .window-tab`, add to the target's `node` and `tab` — same logic as the tab-click handler (line 125–131). Needed for compact-ui where `.window.active` controls stacking; harmless no-op visually in desktop layout.

## Verification

- **Unit tests** (`tests/unit/windows/MediaWindow.test.js`, Vitest/jsdom, `pnpm test`): existing file covers `pickSection`. Add coverage for the `selectMediaItem` match ladder (exact / `-color`-stripped / verseid fallback / miss) and the filter-retry path, driving a constructed MediaWindow or extracted pure helper as jsdom allows.
- **Manual** (`pnpm dev`, chapter with media, e.g. Genesis 12; click a verse's media icon → popup):
  1. MediaWindow open on same chapter → click a thumb → gallery shows that exact image, thumb selected + scrolled into view, popup closed.
  2. MediaWindow on a *different* chapter → click → it switches chapters and focuses the image.
  3. No MediaWindow open → click → one opens focused on the image.
  4. Art filter off in MediaWindow → click → filter re-enables and the image focuses.
  5. Unlinked MediaWindow → still works (direct call bypasses linked-only broadcast).
  6. Compact width (<560px) → media tab becomes active.
  7. Cmd/ctrl/shift-click a popup thumb → still opens the raw image in a new tab; video icon popups unchanged.
