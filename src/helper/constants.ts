const SELECT_DIR = 'select-dir';
export const dirSourceSettingNames = {
    APP_DOCUMENT: `${SELECT_DIR}-app-document`,
    PRESENTING_FLOW: `${SELECT_DIR}-presenting-flow`,
    BACKGROUND_IMAGE: `${SELECT_DIR}-image-bg`,
    BACKGROUND_VIDEO: `${SELECT_DIR}-video-bg`,
    BACKGROUND_WEB: `${SELECT_DIR}-web-bg`,
    BACKGROUND_AUDIO: `${SELECT_DIR}-audio-bg`,
    BIBLE_PRESENT: `${SELECT_DIR}-bible-presenter`,
    BIBLE_READ: `${SELECT_DIR}-bible-read`,
    BIBLE_NOTES: `${SELECT_DIR}-bible-notes`,
};
export const defaultDataDirNames = {
    APP_DOCUMENT: 'documents',
    PRESENTING_FLOW: 'presenting-flows',
    BACKGROUND_IMAGE: 'images',
    BACKGROUND_VIDEO: 'videos',
    BACKGROUND_WEB: 'webs',
    BACKGROUND_AUDIO: 'audios',
    BIBLE_PRESENT: 'bibles',
    BIBLE_READ: 'bibles-read',
    BIBLE_NOTES: 'bible-notes',
};

/**
 * Data folders the APP owns the location of: they sit beside the user-chosen
 * ones under the parent directory (`appLocalStorage.defaultStorage`) and have
 * no `dirSourceSettingNames` entry, because there is nothing to choose. Kept
 * out of `defaultDataDirNames` for exactly that reason — that object is walked
 * key by key to write a directory setting (`selectPathForChildDir`).
 */
export const appManagedDataDirNames = {
    BIBLE_DATA: 'bibles-data',
    // Derived-once indexes over the shipped lookup dataset. Regenerated from
    // that dataset whenever it is missing or stale, so it is safe to delete.
    LOOKUP_DATA: 'lookup-data',
    /**
     * The media helpers (yt-dlp / ffmpeg / qjs) the user installs on demand from
     * Settings > Others. Deliberately NOT registered in
     * `setting/directory-setting/dataDirectories.ts`: the whole-data archive
     * walks that list, and this is ~36MB of binaries that can be downloaded
     * again — it must never be dragged into every backup.
     */
    EXTRA_BIN: 'extra-bin',
};

/**
 * Marks the one-off rename migration (`presentingFlowRenameMigration`) as done.
 * Held here, in a leaf module, so `init()` can check it without pulling the
 * migration itself into the launch bundle.
 */
export const PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME =
    'presenting-flow-rename-migrated';

export const fontSizeSettingNames = {
    BIBLE_PRESENTER: 'bible-preview-font-size:presenter',
    BIBLE_READING: 'bible-preview-font-size:reader',
};

export const screenManagerSettingNames = {
    VARY_APP_DOCUMENT: 'screen-vary-app-document-manager',
    FOREGROUND: 'screen-foreground-manager',
    BACKGROUND: 'screen-bg-manager',
    FULL_TEXT: 'screen-ft-manager',
    MANAGERS: 'screen-managers',
};

// Marks elements that are editor/preview-only affordances (e.g. the play
// badge drawn over a video canvas item). The screen output hides every
// element carrying this attribute.
export const PREVIEW_ONLY_ATTR = 'data-preview-only';

/**
 * A camera canvas item renders as a STATIC placeholder everywhere — the editor
 * canvas, the tool item list, slide thumbnails and print — and is hydrated into
 * a live `getUserMedia` feed only by
 * `ScreenVaryAppDocumentManager.cleanupSlideContent`. A 50-slide document must
 * never open 50 device streams; this app targets very low-spec machines.
 *
 * That means the renderer and the screen manager only ever meet through static
 * HTML (`genSlideHtml` runs the same React tree through `renderToStaticMarkup`),
 * so these attributes are how the markup says "this `<video>` is a camera, and
 * here is which one". `isMirrored`/`objectFit` deliberately get no attribute —
 * they are pure CSS the renderer already bakes inline.
 */
export const CAMERA_ITEM_ATTR = 'data-camera-item';
export const CAMERA_DEVICE_ID_ATTR = 'data-camera-device-id';
export const CAMERA_DEVICE_LABEL_ATTR = 'data-camera-device-label';

/**
 * A website canvas item renders as a STATIC screenshot everywhere — the editor
 * canvas, the tool item list, slide thumbnails and print — and is hydrated into
 * a live `<iframe>` only by
 * `ScreenVaryAppDocumentManager.cleanupSlideContent`. Exactly the camera
 * item's contract above, and for the same reason: an iframe keeps its page's
 * scripts, timers, animations and video running for as long as it is in the
 * DOM, so a 50-slide document would run 50 pages at once. A screenshot costs
 * nothing once taken.
 *
 * That means the renderer and the screen manager only ever meet through static
 * HTML (`genSlideHtml` runs the same React tree through `renderToStaticMarkup`),
 * so these attributes are how the markup says "this box is a website, and here
 * is its url". The screenshot itself deliberately gets no attribute of its own
 * — it is a `PREVIEW_ONLY_ATTR` child that the hydration hides, so a page with
 * a transparent body does not show the stale shot through.
 *
 * NOTE: `sanitizeHtml` (`./sanitizeHelpers.ts`) is still a no-op stub. When a
 * real sanitizer lands it MUST allowlist `data-website-*` and `data-camera-*`,
 * or both item kinds silently stop hydrating on the screen with no error
 * anywhere.
 *
 * The editor additionally swaps the screenshot for a live iframe on hover; that
 * path is pure React and needs no attribute.
 */
export const WEBSITE_ITEM_ATTR = 'data-website-item';
export const WEBSITE_URL_ATTR = 'data-website-url';
/**
 * The already-clamped capture size, as `"<width>x<height>"`.
 *
 * It has to travel in the markup because the two consumers that fill the
 * screenshot in — the mini screen and the print document — both work on a
 * DETACHED div (`genSlideHtml` builds one, and `cleanupSlideContent` runs
 * before it is appended), where every `offsetWidth` is 0. Carrying it also
 * guarantees they ask for the exact size the editor already asked for, so all
 * of them share one cache entry instead of each spawning a capture.
 */
export const WEBSITE_CAPTURE_SIZE_ATTR = 'data-website-capture-size';

/**
 * Shared by the editor's hover preview and the screen's hydrated iframe. They
 * MUST agree: a preview under a tighter sandbox would show the operator a
 * different page than the one that gets projected. `allow-same-origin` is what
 * lets a local `webs/*.html` page read its own assets.
 */
export const WEBSITE_IFRAME_SANDBOX =
    'allow-scripts allow-same-origin allow-forms allow-popups';
export const WEBSITE_IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin';
