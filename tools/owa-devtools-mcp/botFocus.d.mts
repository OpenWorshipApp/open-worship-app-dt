// Types for `botFocus.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the picker, the MCP tool schemas and the manual's focus filter must all agree
// on the set of windows, and the only way to guarantee that is to run the same
// module.

export type BotFocusType =
    | 'presenter'
    | 'reader'
    | 'appDocumentEditor'
    | 'bibleNote'
    | 'setting'
    | 'webEditor'
    | 'lyricEditor'
    | 'lwShare';

export type BotFocusDescriptorType = {
    /** The html base name -- spliced into `page: "<key>.html"` by the tools. */
    key: BotFocusType;
    /** What a volunteer calls this window. */
    label: string;
    /** The page file, e.g. `bibleNote.html`. */
    window: string;
    /** Whether the ONE main window navigates to it, rather than it being its
     * own window that has to be opened. */
    isMainWindow: boolean;
    /** How the user gets there, in the words on the controls. */
    howToOpen: string;
    /** The words on the ONE control that reaches this window, or `null` where
     * no single control does. Pressed by the app for a window of its own;
     * only ringed for a page of the main window, which is navigated to. */
    openFind: string | null;
};

export const BOT_FOCUS_LIST: BotFocusDescriptorType[];
export const BOT_FOCUS_KEYS: BotFocusType[];
export const BOT_MAIN_WINDOW_PAGES: string[];
export const DEFAULT_BOT_FOCUS: BotFocusType;

export function getBotFocus(key: string): BotFocusDescriptorType | null;
export function toBotFocus(value: unknown): BotFocusType;
export function detectBotFocus(pathname: string): BotFocusType | null;
