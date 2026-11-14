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
import {
    findNoteWindow,
    toNoteFileFullName,
    type NoteWindowTargetType,
} from '../helper/ai/noteWindowMatchHelpers';
import {
    toPreviewPathKey,
    toPreviewWindowFilePath,
} from '../helper/ai/windowOnTopRequestHelpers';

// As the main process lists them (`electron/appWindowListHelpers.ts`).
export type AppWindowEntryType = {
    id: string;
    title: string;
    url: string;
};

export type AppWindowType = AppWindowEntryType & {
    // The kind of page; `null` for a FILE's own window (`filePath`), which
    // is no page help is about.
    focus: BotFocusType | null;
    // The ONE main window, which moves between the Presenter, the Reader
    // and the Editor. Every other window is a popup, and every popup's
    // address carries a `uuid`.
    isMain: boolean;
    label: string;
    // A file's own window -- its Markdown Preview, or the PDF viewer -- and
    // the file it shows; absent for a page of the app.
    filePath?: string;
};

export type WindowAimType = {
    windowId: string;
    // `null` for a file's own window.
    focus: BotFocusType | null;
    // A Bible Reader or Slide Editor in a window of its own: `owa_goto_page`
    // moves the MAIN window, not this one.
    isSeparateWindow: boolean;
    // A file's own window: the file it shows (`toFileWindowAim`).
    filePath?: string;
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
// What the APP is doing, and a walkthrough of it: a file's own window is no
// page of the app -- the Markdown Preview has not even Node to answer a
// state read -- so these stay with the app's windows while a tab works in
// one (`toAimedToolArgs`).
const APP_LEVEL_TOOL_NAME_SET: ReadonlySet<string> = new Set([
    'owa_app_state',
    'owa_guide_start',
    'owa_guide_step',
    'owa_guide_status',
]);

const TITLE_PREFIX_PATTERN = /^Open Worship app\s*[-–—]\s*/i;
// The debugging endpoint lists a window's title escaped for HTML -- seen live
// 2026-11-10, `Markdown Preview - JHN.3.The New Birth and God&#39;s Love.md`
// -- so the picker had drawn the escape. One pass, `&amp;` among the rest.
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&amp;': '&',
};

function toUnescapedTitle(title: string) {
    return title.replace(/&(?:lt|gt|quot|#39|amp);/g, (escaped) => {
        return HTML_ESCAPE_MAP[escaped] ?? escaped;
    });
}

/**
 * What a window is called in a sentence and on a picture's chip: the file's
 * name for a file's own window, else its kind (`Settings`).
 */
function toWindowKindName(item: {
    focus: BotFocusType | null;
    filePath?: string;
}) {
    if (item.filePath !== undefined) {
        return toNoteFileFullName(item.filePath);
    }
    return item.focus === null
        ? ''
        : (getBotFocus(item.focus)?.label ?? item.focus);
}

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
 * the same. A FILE's own window -- a Markdown Preview, the PDF viewer -- is
 * listed with the file it shows (`filePath`), for the tab on that file to
 * work in, as a note's tab works in the note's window (2026-11-10, the user,
 * the Resources 🤖 having opened the preview beside a chat whose **Working
 * in** did not name it: _should behave like what working for bible-note_).
 * The help window, the projector screens, the AI Chat and every other page
 * help is not about are left out.
 */
export function toAppWindowList(
    entryList: readonly AppWindowEntryType[],
): AppWindowType[] {
    const windowList: Omit<AppWindowType, 'label'>[] = [];
    for (const entry of entryList) {
        const focus = toFocusOfUrl(entry.url);
        const filePath =
            focus === null ? toPreviewWindowFilePath(entry.url) : null;
        if (focus === null && filePath === null) {
            continue;
        }
        windowList.push({
            ...entry,
            focus,
            isMain: checkIsMainWindowUrl(entry.url),
            ...(filePath === null ? {} : { filePath }),
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
        // language, its mark as it is. A file's window by the file's name
        // when its title does not say it -- a PDF titles itself from inside.
        const fileName =
            item.filePath === undefined ? null : toWindowKindName(item);
        const title = toUnescapedTitle(item.title)
            .replace(TITLE_PREFIX_PATTERN, '')
            .trim();
        const [, words = title, mark = ''] =
            /^(.*?)(\s*\([^()]*\))?$/u.exec(title) ?? [];
        const name =
            fileName !== null && !title.includes(fileName)
                ? fileName
                : title === ''
                  ? tranLabel(toWindowKindName(item))
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
 * The window the help was opened FROM, for its tab to work in (the user,
 * with **Working in** on the main window under a help opened from Settings:
 * _open from setting should select setting_). `openerUrl` is the opener's
 * address, or only its path when main names it on a later launch. The
 * window's id; `null` for the main window, or a path two windows share --
 * the main window is the old way, and a guess at one of two is no aim; and
 * `undefined` while the list does not name it yet (it is asked of main).
 */
export function findOpenerWindowId(
    openerUrl: string,
    windowList: readonly AppWindowType[],
): string | null | undefined {
    let opener: URL;
    try {
        opener = new URL(openerUrl, 'http://localhost/');
    } catch (_error) {
        return null;
    }
    const candidateList = windowList.filter((item) => {
        const url = toUrlObject(item.url);
        return (
            url !== null &&
            url.pathname === opener.pathname &&
            (opener.search === '' || url.search === opener.search)
        );
    });
    if (candidateList.length === 0) {
        return undefined;
    }
    if (candidateList.length > 1 || candidateList[0].isMain) {
        return null;
    }
    return candidateList[0].id;
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
    if (found.focus === null) {
        return toFileAimOf(found);
    }
    const descriptor = getBotFocus(found.focus);
    return {
        windowId: found.id,
        focus: found.focus,
        isSeparateWindow: descriptor?.isMainWindow === true,
    };
}

function toFileAimOf(item: AppWindowType): WindowAimType {
    return {
        windowId: item.id,
        focus: null,
        isSeparateWindow: false,
        ...(item.filePath === undefined ? {} : { filePath: item.filePath }),
    };
}

/**
 * The own window of the FILE a tab is about -- the Markdown Preview or the
 * PDF viewer the Resources 🤖 opened first, or that is open on a file
 * attached in the tab -- as `toNoteWindowAim` is a note's (2026-11-10, the
 * user: _should behave like what working for bible-note_). Null while no
 * window shows that file.
 */
export function toFileWindowAim(
    filePath: string | null | undefined,
    windowList: readonly AppWindowType[],
): WindowAimType | null {
    if (!filePath) {
        return null;
    }
    const key = toPreviewPathKey(filePath);
    const found = windowList.find((item) => {
        return (
            item.filePath !== undefined &&
            !item.isMain &&
            toPreviewPathKey(item.filePath) === key
        );
    });
    return found === undefined ? null : toFileAimOf(found);
}

/**
 * The window a tab ASKING ABOUT a popup kind works in when none is chosen:
 * Settings, a Bible Note, an editor -- the one open window of that kind. A
 * kind the main window shows (Presenter, Reader, Document Editor) is the main
 * window's, the old way. Without it a tab asking about Settings worked in the
 * main window, and a model's walkthrough card -- its call names no window --
 * came up in the Reader, ringing nothing, for a button in Settings (the user,
 * 2026-10-23: _chatbot's do it for me appear in wrong page_). Two windows of
 * the kind are no aim: which one is the person's to say.
 */
export function toFocusWindowAim(
    focus: BotFocusType,
    windowList: readonly AppWindowType[],
): WindowAimType | null {
    if (getBotFocus(focus)?.isMainWindow !== false) {
        return null;
    }
    const candidateList = windowList.filter((item) => {
        return item.focus === focus && !item.isMain;
    });
    if (candidateList.length !== 1) {
        return null;
    }
    return {
        windowId: candidateList[0].id,
        focus,
        isSeparateWindow: false,
    };
}

/**
 * The window of the ONE Bible note a tab is about (2026-11-08, the user,
 * the head of a note conversation reading _Bible Reader_: _chatbot should
 * demand select a bible-note window (open one if not opened)_). A note row's
 * **Open in Chatbot** opens that note's window first, and the tab works in
 * it whatever window the help was opened from; two note windows open are no
 * longer a reason for no aim, since the address names the note. Null while
 * the window is not in the list (it is still loading) or after it closed.
 */
export function toNoteWindowAim(
    target: NoteWindowTargetType | undefined,
    windowList: readonly AppWindowType[],
): WindowAimType | null {
    if (target === undefined) {
        return null;
    }
    const found = findNoteWindow(windowList, target);
    if (found === null || found.isMain) {
        return null;
    }
    return { windowId: found.id, focus: found.focus, isSeparateWindow: false };
}

/**
 * The window a TAB works in, as **Working in** says: the window of the note
 * it is on, else the own window of the file it is on (`filePath`, the
 * newest of its files that has one), else the window chosen for it, else
 * the one window of the kind it asks about when that is a popup (`null` for
 * no kind: a tab only FOLLOWING the window it was opened from). `null` for
 * the main window.
 */
export function toTabWindowAim(
    noteTarget: NoteWindowTargetType | null | undefined,
    chosenWindowId: string | null | undefined,
    focus: BotFocusType | null,
    windowList: readonly AppWindowType[],
    filePath: string | null = null,
): WindowAimType | null {
    return (
        toNoteWindowAim(noteTarget ?? undefined, windowList) ??
        toFileWindowAim(filePath, windowList) ??
        toWindowAim(chosenWindowId, windowList) ??
        (focus === null ? null : toFocusWindowAim(focus, windowList))
    );
}

/**
 * The open window an address is, by the whole address, else by its page
 * and popup `uuid` when one window alone has them; null when none is.
 */
export function findWindowIdByUrl(
    url: string,
    windowList: readonly AppWindowType[],
): string | null {
    const exact = windowList.find((item) => {
        return item.url === url;
    });
    if (exact !== undefined) {
        return exact.id;
    }
    const page = toWindowPage(url);
    const samePageList = windowList.filter((item) => {
        return toWindowPage(item.url) === page;
    });
    return samePageList.length === 1 ? samePageList[0].id : null;
}

/**
 * The address of the window the tab in front works in, which main holds over
 * the main window for as long as it does (2026-11-08 for a Bible note's
 * window; 2026-11-10 for every kind, the user: _imagine chatbot working on an
 * attached window but the window is covered by main window that's wrong
 * behavior_; `electron/windowOnTopHelpers.ts`). `null` for the main window,
 * or none.
 */
export function toHeldWindowUrl(
    aim: WindowAimType | null,
    windowList: readonly AppWindowType[],
): string | null {
    if (aim === null) {
        return null;
    }
    const found = windowList.find((item) => {
        return item.id === aim.windowId;
    });
    return found === undefined || found.isMain ? null : found.url;
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
        label: toWindowKindName(item),
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
    return toWindowKindName(aim);
}

/**
 * A tool call aimed at the tab's window: a UI tool given no window, or given
 * the bare kind of the chosen one (`reader.html` with a Bible Reader window
 * chosen), gets that window's id. Anything else asked for on purpose -- the
 * Presenter while a Reader window is chosen -- goes where it was sent. In a
 * file's own window only what LOOKS at the window is aimed there: a state
 * read and a walkthrough are the app's (`APP_LEVEL_TOOL_NAME_SET`).
 */
export function toAimedToolArgs(
    name: string,
    args: any,
    aim: WindowAimType | null,
) {
    if (aim === null || !AIMED_TOOL_NAME_SET.has(name)) {
        return args;
    }
    if (aim.filePath !== undefined && APP_LEVEL_TOOL_NAME_SET.has(name)) {
        return args;
    }
    const page = args?.page;
    if (
        page === undefined ||
        page === null ||
        page === '' ||
        (aim.focus !== null && page === `${aim.focus}.html`)
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
