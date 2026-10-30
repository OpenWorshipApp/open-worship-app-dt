// @vitest-environment jsdom

import { act, lazy } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    screenUpdateCallbacks: [] as (() => void)[],
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../_screen/managers/screenManagerHooks', () => ({
    useScreenUpdateEvents: (_screenManager: unknown, callback: () => void) => {
        state.screenUpdateCallbacks.push(callback);
    },
}));

import TabRenderComp, {
    genTabBody,
    type TabHeaderPropsType,
} from './TabRenderComp';

type KeyType = 'songs' | 'bibles' | 'media';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.screenUpdateCallbacks = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function getButton(text: string) {
    return Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === text,
    )!;
}

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function fireScreenUpdate() {
    await act(async () => {
        for (const callback of state.screenUpdateCallbacks) {
            callback();
        }
    });
}

const TABS: TabHeaderPropsType<KeyType>[] = [
    { key: 'songs', title: 'Songs', className: 'first-tab' },
    { key: 'bibles', title: 'Bibles' },
    { key: 'media', title: 'Media' },
];

describe('TabRenderComp', () => {
    test('marks the open tabs pressed, in a horizontal strip by default', async () => {
        await act(async () =>
            root.render(
                <TabRenderComp
                    tabs={TABS}
                    activeTabs={['bibles', 'media']}
                    className="my-tabs"
                />,
            ),
        );
        const list = host.querySelector('ul')!;
        expect(list.className).toContain('nav-tabs');
        expect(list.className).toContain('my-tabs');
        expect(list.className).not.toContain('flex-column');
        expect(list.style.overflowX).toBe('auto');
        expect(list.style.overflowY).toBe('hidden');
        const items = Array.from(list.querySelectorAll('li'));
        expect(items.map((item) => item.className)).toEqual([
            'nav-item first-tab',
            'nav-item ',
            'nav-item ',
        ]);
        expect(getButton('Songs').getAttribute('aria-pressed')).toBe('false');
        expect(getButton('Songs').className).not.toContain('active');
        expect(getButton('Bibles').getAttribute('aria-pressed')).toBe('true');
        expect(getButton('Bibles').className).toContain('active');
        expect(getButton('Media').getAttribute('aria-pressed')).toBe('true');
    });

    test('a vertical list scrolls up and down instead', async () => {
        await act(async () =>
            root.render(
                <TabRenderComp tabs={TABS} activeTabs={[]} isVertical />,
            ),
        );
        const list = host.querySelector('ul')!;
        expect(list.className).toContain('flex-column');
        expect(list.className).not.toContain('nav-tabs');
        expect(list.style.overflowY).toBe('auto');
        expect(list.style.overflowX).toBe('hidden');
    });

    test('a click opens the tab', async () => {
        const setActiveTab = vi.fn();
        await act(async () =>
            root.render(
                <TabRenderComp
                    tabs={TABS}
                    activeTabs={['songs']}
                    setActiveTab={setActiveTab}
                />,
            ),
        );
        await act(async () => getButton('Media').click());
        expect(setActiveTab).toHaveBeenCalledExactlyOnceWith(
            'media',
            expect.objectContaining({ type: 'click' }),
        );
    });

    test('a right-click is a click unless the tab has its own menu', async () => {
        const setActiveTab = vi.fn();
        const onContextMenu = vi.fn();
        await act(async () =>
            root.render(
                <TabRenderComp
                    tabs={[
                        { key: 'songs', title: 'Songs' },
                        { key: 'media', title: 'Media', onContextMenu },
                    ]}
                    activeTabs={['songs']}
                    setActiveTab={setActiveTab}
                />,
            ),
        );
        const plain = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => getButton('Songs').dispatchEvent(plain));
        expect(setActiveTab).toHaveBeenLastCalledWith(
            'songs',
            expect.anything(),
        );
        expect(plain.defaultPrevented).toBe(false);

        const withMenu = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => getButton('Media').dispatchEvent(withMenu));
        // It still opens the tab, then hands over to the tab's own menu.
        expect(setActiveTab).toHaveBeenLastCalledWith(
            'media',
            expect.anything(),
        );
        expect(withMenu.defaultPrevented).toBe(true);
        expect(onContextMenu).toHaveBeenCalledExactlyOnceWith(
            'media',
            expect.objectContaining({ type: 'contextmenu' }),
        );
    });

    test('with no handler a press does nothing', async () => {
        await act(async () =>
            root.render(<TabRenderComp tabs={TABS} activeTabs={[]} />),
        );
        await act(async () => getButton('Songs').click());
        expect(getButton('Songs').getAttribute('aria-pressed')).toBe('false');
    });
});

describe('the on-screen dot', () => {
    test('is lit from the first check and follows screen updates, debounced', async () => {
        vi.useFakeTimers();
        const onScreen = new Set<KeyType>(['songs']);
        const checkIsOnScreen = vi.fn(async (key: KeyType) =>
            onScreen.has(key),
        );
        await act(async () =>
            root.render(
                <TabRenderComp
                    tabs={TABS.map((tab) => ({ ...tab, checkIsOnScreen }))}
                    activeTabs={[]}
                />,
            ),
        );
        await flush();
        expect(getButton('Songs').className).toContain('app-on-screen');
        expect(getButton('Bibles').className).not.toContain('app-on-screen');
        expect(checkIsOnScreen).toHaveBeenCalledTimes(3);

        onScreen.clear();
        onScreen.add('bibles');
        await fireScreenUpdate();
        await fireScreenUpdate();
        // Nothing until the burst has been quiet for 500ms.
        await act(async () => vi.advanceTimersByTimeAsync(499));
        expect(checkIsOnScreen).toHaveBeenCalledTimes(3);
        await act(async () => vi.advanceTimersByTimeAsync(1));
        await flush();
        // One re-check per tab, each with its own timer.
        expect(checkIsOnScreen).toHaveBeenCalledTimes(6);
        expect(getButton('Songs').className).not.toContain('app-on-screen');
        expect(getButton('Bibles').className).toContain('app-on-screen');
        expect(getButton('Media').className).not.toContain('app-on-screen');
    });

    test('a tab that cannot be on a screen never checks', async () => {
        vi.useFakeTimers();
        await act(async () =>
            root.render(<TabRenderComp tabs={TABS} activeTabs={[]} />),
        );
        await flush();
        await fireScreenUpdate();
        await act(async () => vi.advanceTimersByTimeAsync(500));
        await flush();
        expect(host.querySelector('.app-on-screen')).toBeNull();
    });
});

describe('genTabBody', () => {
    const LazyBodyComp = lazy(async () => ({
        default: () => <p className="tab-body">Body</p>,
    }));

    test('renders the selected tab body inside a suspense boundary', async () => {
        await act(async () =>
            root.render(genTabBody<KeyType>('songs', ['songs', LazyBodyComp])),
        );
        await flush();
        expect(host.querySelector('.tab-body')!.textContent).toBe('Body');
    });

    test('renders nothing for a tab that is not selected', async () => {
        await act(async () =>
            root.render(genTabBody<KeyType>('media', ['songs', LazyBodyComp])),
        );
        await flush();
        expect(host.innerHTML).toBe('');
    });
});
