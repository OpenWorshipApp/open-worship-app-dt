// Which window of the app a question is ABOUT.
//
// Deliberately free of `node:fs` and of every other node built-in, for the same
// reason as `questionMatch.mjs`: the MCP server imports it to build its tool
// schemas, and the chatbot window bundles the very same module to draw its
// "asking about" picker. One declaration, two callers.
//
// The set is declared ONCE, here. It used to be a two-value union written out
// by hand in eight places -- the type, the picker list, the opener sniff, the
// session validator, the fallback starters, two zod enums and a
// `focus !== 'presenter' && focus !== 'reader'` guard -- and every one of them
// had to be found and edited together or a window silently answered as the
// presenter.
//
// `key` is NOT a label: it is spliced into `page: "<key>.html"` for
// `owa_find_ui` / `owa_app_state`, so it must stay the html file's base name.

/**
 * @typedef {object} BotFocusDescriptorType
 * @property {string} key The html base name, e.g. `bibleNote`.
 * @property {string} label What a volunteer calls this window.
 * @property {string} window The page file, e.g. `bibleNote.html`.
 * @property {boolean} isMainWindow Whether it is a page the ONE main window
 *   navigates between (so `owa_goto_page` can switch to it), rather than a
 *   window of its own that has to be opened.
 * @property {string} howToOpen How the user gets there from where they are,
 *   in the words on the controls. Read by the model's system prompt when a
 *   tool answers that no page matches.
 * @property {string|null} openFind The words on the ONE control that reaches
 *   this window, or `null` where no single control does -- three of these
 *   need something SELECTED first and one lives in the native menu bar, which
 *   is in no page's DOM. For a window of its own the app PRESSES it, so a
 *   volunteer who asked for a walkthrough of a window that is not up gets the
 *   window opened instead of an apology. For a page of the main window it is
 *   only what gets ringed if navigating there fails: `owa_goto_page` is the
 *   way across, and it waits for the arrival that a click cannot.
 */

/** @type {BotFocusDescriptorType[]} */
export const BOT_FOCUS_LIST = [
    {
        key: 'presenter',
        label: 'Presenter',
        window: 'presenter.html',
        isMainWindow: true,
        howToOpen:
            'from the Bible Reader it is the 🖥️ button at the top right; ' +
            'from the Document Editor it is the Presenter tab at the top',
        openFind: 'Go Back to Presenter',
    },
    {
        key: 'reader',
        label: 'Bible Reader',
        window: 'reader.html',
        isMainWindow: true,
        howToOpen: 'the 📖 Bible Reader tab at the top of the window',
        openFind: 'Bible Reader',
    },
    {
        key: 'appDocumentEditor',
        label: 'Document Editor',
        window: 'appDocumentEditor.html',
        isMainWindow: true,
        howToOpen: 'the ✏️ Editor tab at the top of the window',
        openFind: 'Slide Editor',
    },
    {
        key: 'bibleNote',
        label: 'Bible Note',
        window: 'bibleNote.html',
        isMainWindow: false,
        howToOpen: 'double-click a note in the Bible Notes panel',
        openFind: null,
    },
    {
        key: 'setting',
        label: 'Settings',
        window: 'setting.html',
        isMainWindow: false,
        howToOpen: 'the ⚙️ button at the top right of the window',
        openFind: 'Setting',
    },
    {
        key: 'webEditor',
        label: 'Web Editor',
        window: 'webEditor.html',
        isMainWindow: false,
        howToOpen:
            'in the Background panel, open Web and double-click a web page',
        openFind: null,
    },
    {
        key: 'lyricEditor',
        label: 'Lyric Editor',
        window: 'lyricEditor.html',
        isMainWindow: false,
        howToOpen: 'open a song from the Documents panel and press Edit',
        openFind: null,
    },
    {
        key: 'lwShare',
        label: 'Local Web Share',
        window: 'lwShare.html',
        isMainWindow: false,
        howToOpen: 'the Tools menu → Local Web Share',
        openFind: null,
    },
];

/**
 * The pages the ONE main window navigates between, as page files.
 *
 * This is `owa_goto_page`'s whole vocabulary, and it is derived rather than
 * written out because the system prompt promises the model it can cross to any
 * window marked `isMainWindow` -- the enum said `presenter.html` and
 * `reader.html` only, so every crossing to the Document Editor was refused by
 * the tool the prompt had just told the model to use.
 */
export const BOT_MAIN_WINDOW_PAGES = BOT_FOCUS_LIST.filter((item) => {
    return item.isMainWindow;
}).map((item) => {
    return item.window;
});

/** Every focus key, in picker order. Handy for a zod enum or a test loop. */
export const BOT_FOCUS_KEYS = BOT_FOCUS_LIST.map((item) => {
    return item.key;
});

const FOCUS_MAP = new Map(
    BOT_FOCUS_LIST.map((item) => {
        return [item.key, item];
    }),
);

/** The descriptor for a key, or `null` when nothing declares it. */
export function getBotFocus(key) {
    return FOCUS_MAP.get(key) ?? null;
}

/** The focus every unknown or missing one falls back to. */
export const DEFAULT_BOT_FOCUS = 'presenter';

/**
 * The key for something that may not be one -- a value read back off disk, off
 * a URL, or handed in by a model. Never throws: an unrecognised focus answers
 * as the presenter rather than as nothing at all.
 */
export function toBotFocus(value) {
    return FOCUS_MAP.has(value) ? value : DEFAULT_BOT_FOCUS;
}

/**
 * Which window a URL (or a bare pathname) is showing.
 *
 * Matched on the window file name rather than on a substring of the key, so
 * `presenter.html` cannot be claimed by a key that merely contains "present",
 * and the LONGEST window name wins -- `appDocumentEditor.html` would otherwise
 * be taken by nothing at all while `bibleNote.html` is fine either way.
 */
export function detectBotFocus(pathname) {
    if (typeof pathname !== 'string' || pathname.length === 0) {
        return null;
    }
    let found = null;
    for (const item of BOT_FOCUS_LIST) {
        if (
            pathname.includes(item.window) &&
            (found === null || item.window.length > found.window.length)
        ) {
            found = item;
        }
    }
    return found === null ? null : found.key;
}
