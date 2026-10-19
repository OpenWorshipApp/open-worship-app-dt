// Which WINDOW of the app a tab works with (2026-10-15, the user's ask with a
// Bible Reader window open beside the main one: _chatbot work with main
// window only, imagine I have more child windows like slide editor lyric
// editor bible reader ... then want the chatbot to help troubleshooting or
// guide in child window, it's impossible now. Let add window selection (if
// more child window), after window change the chatbot should work with the
// selected window_).
//
// "Asking about" names a KIND of window, and every tool aims by a piece of an
// address (`page: "reader.html"`), the first window it fits winning. A Bible
// Reader window opened from the main one is `reader.html?uuid=reader` -- and
// so is a second one -- so a kind cannot say which. A window's DevTools id
// can, and `pickTarget` takes it as `page`. Pure, apart from the one aim the
// tab in front holds.

import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';
import {
    BOT_FOCUS_LIST,
    getBotFocus,
} from '../../tools/owa-devtools-mcp/botFocus.mjs';
import { fillWords, tran, tranLabel } from './chatTranHelpers';

// As the main process lists them (`electron/appWindowListHelpers.ts`).
export type AppWindowEntryType = {
    id: string;
    title: string;
    url: string;
};

export type AppWindowType = AppWindowEntryType & {
    focus: BotFocusType;
    // The ONE main window, which moves between the Presenter, the Reader
    // and the Editor. Every other window is a popup, and every popup's
    // address carries a `uuid`.
    isMain: boolean;
    label: string;
};

export type WindowAimType = {
    windowId: string;
    focus: BotFocusType;
    // A Bible Reader or Slide Editor in a window of its own: `owa_goto_page`
    // moves the MAIN window, not this one.
    isSeparateWindow: boolean;
};

export const LIST_APP_WINDOWS_CHANNEL = 'main:app:list-app-windows';
// Pushed by main when a window comes, goes or changes
// (`initAppWindowListWatch` in `electron/appWindowListHelpers.ts`).
export const APP_WINDOWS_CHANGED_CHANNEL = 'main:app:app-windows-changed';

// The tools whose `page` is the window they look at or act on. The data
// tools take a `page` too, of another meaning, and are left alone.
const AIMED_TOOL_NAME_SET: ReadonlySet<string> = new Set([
    'owa_app_state',
    'owa_screenshot',
    'owa_find_ui',
    'owa_list_ui',
    'owa_click',
    'owa_type',
    'owa_highlight_selector',
    'owa_pick_element',
    'owa_press_key',
    'owa_scroll',
    'owa_guide_start',
    'owa_guide_step',
    'owa_guide_status',
]);

const TITLE_PREFIX_PATTERN = /^Open Worship app\s*[-–—]\s*/i;

function toUrlObject(url: string) {
    try {
        return new URL(url);
    } catch (_error) {
        return null;
    }
}

/** The kind of window an address is, or `null` for one help is not about. */
export function toFocusOfUrl(url: string): BotFocusType | null {
    const fileName = toUrlObject(url)?.pathname.split('/').pop() ?? '';
    const found = BOT_FOCUS_LIST.find((item) => {
        return item.window === fileName;
    });
    return found ? (found.key as BotFocusType) : null;
}

/**
 * Whether an address is the ONE main window's: a page the main window moves
 * between, opened with no `uuid`. Every popup carries one -- except Local Web
 * Share, which main loads itself, and which is never the main window.
 */
export function checkIsMainWindowUrl(url: string) {
    const focus = toFocusOfUrl(url);
    return (
        focus !== null &&
        getBotFocus(focus)?.isMainWindow === true &&
        !toUrlObject(url)?.searchParams.has('uuid')
    );
}

/**
 * The windows a tab can work with, the main window first, each with the
 * words the picker shows: the window's own title (which names the song in a
 * Lyric Editor) and whether it is the main window, numbered when two read
 * the same. The help window, the projector screens, the AI Chat and every
 * page help is not about are left out.
 */
export function toAppWindowList(
    entryList: readonly AppWindowEntryType[],
): AppWindowType[] {
    const windowList: Omit<AppWindowType, 'label'>[] = [];
    for (const entry of entryList) {
        const focus = toFocusOfUrl(entry.url);
        if (focus === null) {
            continue;
        }
        windowList.push({
            ...entry,
            focus,
            isMain: checkIsMainWindowUrl(entry.url),
        });
    }
    windowList.sort((one, other) => {
        return Number(other.isMain) - Number(one.isMain);
    });
    const seenCountMap = new Map<string, number>();
    // The picker's words, in the window's language: nothing reads a label
    // back, and what the model is told is `toAttachmentWindow`'s own.
    return windowList.map((item) => {
        // The window's own title, `Setting (⚙️)`: its name in the window's
        // language, its mark as it is.
        const title = item.title.replace(TITLE_PREFIX_PATTERN, '').trim();
        const [, words = title, mark = ''] =
            /^(.*?)(\s*\([^()]*\))?$/u.exec(title) ?? [];
        const name =
            title === ''
                ? tranLabel(getBotFocus(item.focus)?.label ?? item.focus)
                : tranLabel(words.trim()) + mark;
        const base = fillWords(
            item.isMain
                ? tran('{name} · main window')
                : tran('{name} · own window'),
            { name },
        );
        const count = (seenCountMap.get(base) ?? 0) + 1;
        seenCountMap.set(base, count);
        return { ...item, label: count > 1 ? `${base} ${count}` : base };
    });
}

/**
 * What a tab with a window of its own chosen works with, or `null` for the
 * main window -- which is the help's way of working as it always has (the
 * kind of page, the main window when a tool is given none). A window that
 * has gone is no aim.
 */
export function toWindowAim(
    windowId: string | null | undefined,
    windowList: readonly AppWindowType[],
): WindowAimType | null {
    if (!windowId) {
        return null;
    }
    const found = windowList.find((item) => {
        return item.id === windowId;
    });
    if (found === undefined || found.isMain) {
        return null;
    }
    const descriptor = getBotFocus(found.focus);
    return {
        windowId: found.id,
        focus: found.focus,
        isSeparateWindow: descriptor?.isMainWindow === true,
    };
}

/**
 * Which window a 📷 picture or a ◎ pointed-at control came from, kept ON the
 * attachment (2026-10-15, the user: _make sure screenshot and element
 * selection have uuid information to the window to let mcp know_). `id` is
 * the window's DevTools id, which a tool takes as `page` -- good for this
 * launch; `page` is its page and its popup `uuid` (`setting.html?uuid=setting`),
 * which still finds a window of its own after a relaunch; `label` is what the
 * model calls it.
 */
export type AttachmentWindowType = {
    id: string;
    page: string;
    label: string;
    isMain: boolean;
};

/** A window's page as a tool finds it: its file, and its popup `uuid`. */
export function toWindowPage(url: string) {
    const urlObject = toUrlObject(url);
    if (urlObject === null) {
        return url;
    }
    const fileName = urlObject.pathname.split('/').pop() ?? '';
    const uuid = urlObject.searchParams.get('uuid');
    return uuid === null
        ? fileName
        : `${fileName}?uuid=${encodeURIComponent(uuid)}`;
}

export function toAttachmentWindow(item: AppWindowType): AttachmentWindowType {
    return {
        id: item.id,
        page: toWindowPage(item.url),
        label: getBotFocus(item.focus)?.label ?? item.focus,
        isMain: item.isMain,
    };
}

/**
 * The window a picture or a pointing happens in right now: the one the tab
 * works with, else the main window. `null` while the list is not known.
 */
export function findAttachmentWindow(
    aim: WindowAimType | null,
    windowList: readonly AppWindowType[],
): AttachmentWindowType | null {
    const found = windowList.find((item) => {
        return aim === null ? item.isMain : item.id === aim.windowId;
    });
    return found === undefined ? null : toAttachmentWindow(found);
}

/**
 * The `page` that reaches an attachment's window NOW: its id while that
 * window is open; after a relaunch, the main window's new id, or a popup by
 * its page and `uuid`. `undefined` means the main window, the tools' default.
 */
export function toAttachmentWindowPage(
    attachedWindow: AttachmentWindowType,
    windowList: readonly AppWindowType[],
) {
    if (
        windowList.some((item) => {
            return item.id === attachedWindow.id;
        })
    ) {
        return attachedWindow.id;
    }
    if (attachedWindow.isMain) {
        return windowList.find((item) => {
            return item.isMain;
        })?.id;
    }
    return attachedWindow.page;
}

/**
 * What the help calls the chosen window in a sentence -- "Point at the
 * control you mean in the Settings window" -- or `null` for the main window.
 */
export function toWindowAimLabel(aim: WindowAimType | null) {
    if (aim === null) {
        return null;
    }
    return getBotFocus(aim.focus)?.label ?? aim.focus;
}

/**
 * A tool call aimed at the tab's window: a UI tool given no window, or given
 * the bare kind of the chosen one (`reader.html` with a Bible Reader window
 * chosen), gets that window's id. Anything else asked for on purpose -- the
 * Presenter while a Reader window is chosen -- goes where it was sent.
 */
export function toAimedToolArgs(
    name: string,
    args: any,
    aim: WindowAimType | null,
) {
    if (aim === null || !AIMED_TOOL_NAME_SET.has(name)) {
        return args;
    }
    const page = args?.page;
    if (
        page === undefined ||
        page === null ||
        page === '' ||
        page === `${aim.focus}.html`
    ) {
        return { ...(args ?? {}), page: aim.windowId };
    }
    return args;
}

// The window chosen in the tab IN FRONT, for the calls that run in it and
// finish in a moment: a `/` command, the offline guide, a button pressed.
// A model's answer can outlast a switch of tabs, so it carries the aim it
// was asked with instead (`AskExtraType.windowAim`).
let currentWindowAim: WindowAimType | null = null;

export function setCurrentWindowAim(aim: WindowAimType | null) {
    currentWindowAim = aim;
}

export function getCurrentWindowAim() {
    return currentWindowAim;
}
