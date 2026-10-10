/**
 * The native menu bar, for an agent: what is in it, and pressing one item.
 *
 * Every other control an agent reaches is in a renderer's DOM. The menu bar is
 * the main process's -- Electron draws it, and no page expression can see it or
 * press it -- so a user could do a dozen things (Reload, the View menu's widget
 * toggles and Reset Widgets Size, Export Data, Local Web Share, the Help items)
 * that no tool could, and a walkthrough step reading "open the View menu" could
 * only apologise (W-31). `owa_menu` asks here over IPC.
 *
 * What it will not press, whatever it is asked: anything that would take the
 * app down or open a door onto the machine. `toggleDevTools` is a console with
 * Node in every renderer -- the same reach `evaluate_script` was denied for;
 * `quit`, `close` and `Relaunch` end the operator's windows (and Relaunch asks
 * through a NATIVE dialog nothing here could answer); the macOS app-menu roles
 * hide the app. Refused by role or label, with the reason, and marked in the
 * list so a caller need not try.
 */
import { BrowserWindow, Menu, type MenuItem } from 'electron';

export const AGENT_MENU_LIST_CHANNEL = 'main:app:agent-menu-list';
export const AGENT_MENU_CLICK_CHANNEL = 'main:app:agent-menu-click';

const DENIED_ROLE_SET = new Set([
    'toggledevtools',
    'quit',
    'close',
    'hide',
    'hideothers',
    'unhide',
    'services',
    'front',
    'window',
    'startspeaking',
    'stopspeaking',
]);
// Labels, for the items that carry no role. Compared case-insensitively.
const DENIED_LABEL_SET = new Set(['relaunch']);

export type AgentMenuEntryType = {
    /** `View > Reload`: the labels from the bar down, joined by ` > `. */
    path: string;
    label: string;
    isEnabled: boolean;
    isChecked?: boolean;
    hasSubmenu?: boolean;
    /** Present with the reason when this item will not be pressed. */
    refused?: string;
};

type MenuLikeType = { items: MenuItem[] } | null | undefined;

function findRefusal(item: MenuItem) {
    const role = String(item.role ?? '').toLowerCase();
    if (role === 'toggledevtools') {
        return (
            'Developer Tools is a console with full access to the computer ' +
            'in every window of this app, so it is not opened for anyone.'
        );
    }
    if (DENIED_ROLE_SET.has(role)) {
        return (
            'That closes or hides the app, every window of it, so it is ' +
            "the user's to press."
        );
    }
    if (DENIED_LABEL_SET.has(String(item.label ?? '').toLowerCase())) {
        return (
            'That closes and reopens the app -- every window, a screen in ' +
            'front of a congregation included -- and asks through a dialog ' +
            "nothing here can answer. It is the user's to press."
        );
    }
    return null;
}

function toEntry(item: MenuItem, path: string): AgentMenuEntryType {
    const entry: AgentMenuEntryType = {
        path,
        label: item.label,
        isEnabled: item.enabled !== false,
    };
    if (item.type === 'checkbox' || item.type === 'radio') {
        entry.isChecked = item.checked === true;
    }
    if (item.submenu !== undefined && item.submenu !== null) {
        entry.hasSubmenu = true;
    }
    const refused = findRefusal(item);
    if (refused !== null) {
        entry.refused = refused;
    }
    return entry;
}

/**
 * Every pressable item top to bottom with its path -- the one walk the list
 * and the lookup share, so what one shows is exactly what the other finds.
 */
function* walkMenu(
    menu: MenuLikeType,
    parentPath = '',
): Generator<{ item: MenuItem; label: string; path: string }> {
    for (const item of menu?.items ?? []) {
        if (item.type === 'separator' || item.visible === false) {
            continue;
        }
        const label = String(item.label ?? '').trim();
        if (label === '') {
            continue;
        }
        const path = parentPath === '' ? label : `${parentPath} > ${label}`;
        yield { item, label, path };
        yield* walkMenu(item.submenu as MenuLikeType, path);
    }
}

/** Every item in the bar, top to bottom, each with its path. */
export function listAgentMenuItems(
    menu: MenuLikeType = Menu.getApplicationMenu(),
) {
    const out: AgentMenuEntryType[] = [];
    for (const { item, path } of walkMenu(menu)) {
        out.push(toEntry(item, path));
    }
    return out;
}

/** `view>reload`, `View  >  Reload` and `View > Reload` are one spelling. */
function normalize(text: string) {
    return text
        .replace(/\s*>\s*/g, ' > ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * The item a path names: `View > Reload` exactly, or a bare label when exactly
 * one item in the whole bar carries it (`Reload`). Two items sharing a bare
 * label are answered with both paths rather than one guessed at.
 */
export function findAgentMenuItem(
    wanted: string,
    menu: MenuLikeType = Menu.getApplicationMenu(),
): { item: MenuItem; path: string } | { reason: string } {
    const asked = normalize(wanted);
    if (asked === '') {
        return { reason: 'Name the menu item, as "View > Reload".' };
    }
    const found: { item: MenuItem; path: string }[] = [];
    for (const { item, label, path } of walkMenu(menu)) {
        if (normalize(path) === asked) {
            return { item, path };
        }
        if (normalize(label) === asked) {
            found.push({ item, path });
        }
    }
    if (found.length === 1) {
        return found[0];
    }
    if (found.length > 1) {
        return {
            reason:
                `"${wanted}" is on more than one item: ` +
                found
                    .map((one) => {
                        return `"${one.path}"`;
                    })
                    .join(', ') +
                '. Name one with its menu, as "View > Reload".',
        };
    }
    return {
        reason:
            `There is no menu item called "${wanted}". Action "list" names ` +
            'every one, with its path.',
    };
}

/**
 * Press the item, the way the bar does: Electron's own `click`, handed the
 * window that asked so a role (Reload, Zoom In) acts on it. Answers what was
 * pressed, or why not.
 */
export function clickAgentMenuItem(
    wanted: string,
    win: BrowserWindow | null,
    menu: MenuLikeType = Menu.getApplicationMenu(),
) {
    const found = findAgentMenuItem(wanted, menu);
    if ('reason' in found) {
        return { isError: true, reason: found.reason };
    }
    const { item, path } = found;
    const refused = findRefusal(item);
    if (refused !== null) {
        return {
            isError: true,
            reason: `"${path}" is not pressed: ${refused}`,
        };
    }
    if (item.submenu !== undefined && item.submenu !== null) {
        return {
            isError: true,
            reason:
                `"${path}" opens a menu rather than doing anything. Name an ` +
                'item inside it.',
        };
    }
    if (item.enabled === false) {
        return {
            isError: true,
            reason: `"${path}" is greyed out right now, so it was not pressed.`,
        };
    }
    const targetWin =
        win !== null && !win.isDestroyed()
            ? win
            : BrowserWindow.getFocusedWindow();
    const wasChecked =
        item.type === 'checkbox' || item.type === 'radio'
            ? item.checked === true
            : undefined;
    item.click(
        undefined,
        targetWin ?? undefined,
        targetWin?.webContents ?? undefined,
    );
    return {
        clicked: path,
        ...(wasChecked === undefined
            ? {}
            : { isCheckedNow: item.checked === true }),
    };
}
