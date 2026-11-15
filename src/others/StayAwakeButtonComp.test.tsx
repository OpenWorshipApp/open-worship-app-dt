// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The real `appHomeStorage` runs over this, so what is asserted is the message
// the main process actually receives -- it acts on that write and on nothing
// else.
const h = vi.hoisted(() => ({
    stored: null as string | null,
    appProvider: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: {
            sendDataSync: vi.fn(),
            sendData: vi.fn(),
        },
    },
}));

const menu = vi.hoisted(() => ({
    showAppContextMenu: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    getCurrentLocale: () => 'en-US',
}));
// The menu itself is `AppContextMenuComp`'s to draw; what is asserted is what
// the cup hands it and what each row writes.
vi.mock('../context-menu/appContextMenuHelpers', () => menu);

import StayAwakeButtonComp from './StayAwakeButtonComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

function getButton() {
    return container.querySelector('button')!;
}

function clickButton() {
    act(() => {
        getButton().dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
}

type MenuItemType = {
    menuElement: string;
    childBefore: { props: { style: { opacity: number } } };
    onSelect?: () => void;
};

// Presses the cup and answers the rows its menu was handed: the label, and
// whether the row is ticked.
function openMenu() {
    menu.showAppContextMenu.mockClear();
    clickButton();
    expect(menu.showAppContextMenu).toHaveBeenCalledTimes(1);
    const [, items, options] = menu.showAppContextMenu.mock.calls[0];
    return {
        items: items as MenuItemType[],
        options,
        rows: (items as MenuItemType[]).map((item) => {
            const isTicked = item.childBefore.props.style.opacity === 1;
            return `${isTicked ? '✓ ' : ''}${item.menuElement}`;
        }),
    };
}

function selectRow(label: string) {
    const { items } = openMenu();
    const item = items.find((candidate) => {
        return candidate.menuElement === label;
    })!;
    act(() => {
        item.onSelect!();
    });
}

const NOW = new Date(2026, 10, 15, 11, 47, 0).getTime();

// Some ICU builds put a narrow no-break space before "PM".
function toPlainSpaces(text: string) {
    return text.replace(/\s/gu, ' ');
}

describe('StayAwakeButtonComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.stored = null;
        h.appProvider.messageUtils.sendDataSync.mockImplementation(
            (channel: string, data: { type: string; key: string }) => {
                return channel === 'main:app:client-setting' &&
                    data.type === 'get' &&
                    data.key === 'stay-awake'
                    ? h.stored
                    : null;
            },
        );
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
        vi.useRealTimers();
    });

    test('is on when nothing was ever written', async () => {
        await render(<StayAwakeButtonComp />);

        const button = getButton();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.getAttribute('aria-label')).toBe('Stay Awake');
        expect(button.title).toBe(
            'Stay Awake — this computer will not sleep while this page is open',
        );
        expect(button.className).toBe('btn btn-outline-info');
        expect(button.querySelector('i')!.className).toBe('bi bi-cup-hot-fill');
        // Drawing it writes nothing: the default is not a stored value.
        expect(h.appProvider.messageUtils.sendData).not.toHaveBeenCalled();
    });

    test('opens switched off when it was left off', async () => {
        h.stored = 'false';
        await render(<StayAwakeButtonComp className="btn-sm ms-auto" />);

        const button = getButton();
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.title).toBe(
            'Stay Awake — turned off, this computer may sleep when no screen' +
                ' is showing',
        );
        expect(button.className).toBe(
            'btn btn-outline-secondary btn-sm ms-auto',
        );
        expect(button.querySelector('i')!.className).toBe('bi bi-cup');
    });

    test('a press opens the choices under the cup, the current one ticked', async () => {
        await render(<StayAwakeButtonComp />);

        expect(getButton().getAttribute('aria-haspopup')).toBe('menu');
        const { rows, options } = openMenu();
        expect(rows).toEqual([
            '✓ Until I turn it off',
            'For 30 minutes',
            'For 1 hour',
            'For 2 hours',
            'For 4 hours',
            'Off',
        ]);
        expect(options).toEqual({ coord: { x: 0, y: 0 } });
        // Opening it writes nothing.
        expect(h.appProvider.messageUtils.sendData).not.toHaveBeenCalled();
    });

    test('each choice writes the setting the main process acts on', async () => {
        vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
        await render(<StayAwakeButtonComp />);

        selectRow('Off');
        expect(h.appProvider.messageUtils.sendData).toHaveBeenLastCalledWith(
            'main:app:client-setting',
            { type: 'set', key: 'stay-awake', value: 'false' },
        );
        expect(getButton().getAttribute('aria-pressed')).toBe('false');
        expect(openMenu().rows.at(-1)).toBe('✓ Off');

        selectRow('Until I turn it off');
        expect(h.appProvider.messageUtils.sendData).toHaveBeenLastCalledWith(
            'main:app:client-setting',
            { type: 'set', key: 'stay-awake', value: 'true' },
        );
        expect(getButton().getAttribute('aria-pressed')).toBe('true');

        const minutesByLabel = {
            'For 30 minutes': 30,
            'For 1 hour': 60,
            'For 2 hours': 120,
            'For 4 hours': 240,
        };
        for (const [label, minutes] of Object.entries(minutesByLabel)) {
            selectRow(label);
            expect(
                h.appProvider.messageUtils.sendData,
            ).toHaveBeenLastCalledWith('main:app:client-setting', {
                type: 'set',
                key: 'stay-awake',
                value: `${NOW + minutes * 60_000}`,
            });
        }
        expect(h.appProvider.messageUtils.sendData).toHaveBeenCalledTimes(6);
    });

    test('a running timer says when it ends and turns the cup off then', async () => {
        vi.useFakeTimers({ now: NOW });
        h.stored = `${NOW + 2 * 60 * 60_000}`;
        await render(<StayAwakeButtonComp />);

        const button = getButton();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.className).toBe('btn btn-outline-info');
        expect(button.querySelector('i')!.className).toBe('bi bi-cup-hot');
        expect(toPlainSpaces(button.title)).toBe(
            'Stay Awake — this computer will not sleep while this page is' +
                ' open, until 1:47 PM',
        );
        const { rows, items } = openMenu();
        expect(rows.map(toPlainSpaces)).toEqual([
            '✓ Until 1:47 PM',
            'Until I turn it off',
            'For 30 minutes',
            'For 1 hour',
            'For 2 hours',
            'For 4 hours',
            'Off',
        ]);
        // Choosing the running timer keeps it: nothing is written.
        act(() => {
            items[0].onSelect!();
        });
        expect(h.appProvider.messageUtils.sendData).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(2 * 60 * 60_000 - 1);
        });
        expect(button.querySelector('i')!.className).toBe('bi bi-cup-hot');
        await act(async () => {
            vi.advanceTimersByTime(1);
        });
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.querySelector('i')!.className).toBe('bi bi-cup');
        expect(openMenu().rows.at(-1)).toBe('✓ Off');
        // Running out writes nothing: the moment past already reads as off.
        expect(h.appProvider.messageUtils.sendData).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a timer that ran out while the app was closed opens off', async () => {
        vi.useFakeTimers({ now: NOW });
        h.stored = `${NOW - 1}`;
        await render(<StayAwakeButtonComp />);

        expect(getButton().getAttribute('aria-pressed')).toBe('false');
        expect(getButton().querySelector('i')!.className).toBe('bi bi-cup');
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a timer past midnight says the day too', async () => {
        vi.useFakeTimers({ now: new Date(2026, 10, 15, 22, 30).getTime() });
        h.stored = `${new Date(2026, 10, 16, 2, 30).getTime()}`;
        await render(<StayAwakeButtonComp />);

        expect(toPlainSpaces(getButton().title)).toBe(
            'Stay Awake — this computer will not sleep while this page is' +
                ' open, until Nov 16, 2:30 AM',
        );
    });
});
