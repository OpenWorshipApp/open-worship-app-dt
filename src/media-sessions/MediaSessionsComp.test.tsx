// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
    mocks: {
        removeSetting: vi.fn(),
        showAppContextMenu: vi.fn(),
        showAppInput: vi.fn(),
        showAppConfirm: vi.fn(),
        subscribeSlideAutoPlayState: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
    useAppEffect: useEffect,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
    removeSetting: mocks.removeSetting,
    useStateSettingString: (name: string, defaultValue: string) => {
        const [value, setValue] = useState(
            () => state.settings.get(name) ?? defaultValue,
        );
        return [
            value,
            (nextValue: string) => {
                state.settings.set(name, nextValue);
                setValue(nextValue);
            },
        ];
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirm,
    showAppInput: mocks.showAppInput,
}));
vi.mock('../slide-auto-play/slideAutoPlayRuleHelpers', () => ({
    subscribeSlideAutoPlayState: mocks.subscribeSlideAutoPlayState,
}));

import MediaSessionsComp, {
    addMediaSession,
    genMediaSessionId,
    readSessions,
    toSessionLabel,
    toSessionSuffix,
    useMediaSessionAutoPlayRefresh,
    useMediaSessions,
} from './MediaSessionsComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('media sessions', () => {
    it('uses the legacy default id and recovers from malformed saved lists', () => {
        expect(toSessionSuffix('')).toBe('');
        expect(toSessionSuffix('s123')).toBe('-s123');
        expect(toSessionLabel({ id: '', name: 'Default' })).toBe('Default');
        expect(toSessionLabel({ id: 's123', name: 'Sunday' })).toBe('Sunday');
        expect(readSessions('background-image')).toEqual([
            { id: '', name: 'Default' },
        ]);

        state.settings.set('background-image-sessions', '{');
        expect(readSessions('background-image')).toEqual([
            { id: '', name: 'Default' },
        ]);
        state.settings.set('background-image-sessions', '{}');
        expect(readSessions('background-image')).toEqual([
            { id: '', name: 'Default' },
        ]);
        state.settings.set('background-image-sessions', '[null,{},42]');
        expect(readSessions('background-image')).toEqual([
            { id: '', name: 'Default' },
        ]);
        state.settings.set(
            'background-image-sessions',
            JSON.stringify([
                null,
                { id: 's1', name: 'Sunday' },
                { id: 7, name: 'bad' },
            ]),
        );
        expect(readSessions('background-image')).toEqual([
            { id: 's1', name: 'Sunday' },
        ]);
    });

    it('adds a unique session, renames it, and selects a surviving session on removal', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(12345);
        let sessions!: ReturnType<typeof useMediaSessions>;
        function HarnessComp() {
            sessions = useMediaSessions('foreground-image');
            return <span>{sessions.activeSession.name}</span>;
        }
        await act(async () => root.render(<HarnessComp />));
        expect(sessions.activeId).toBe('');
        await act(async () => sessions.addSession());
        const added = sessions.activeId;
        expect(added).toBe('s9ix');
        expect(sessions.sessions).toEqual([
            { id: '', name: 'Default' },
            { id: added, name: 'Session 2' },
        ]);
        expect(container.textContent).toBe('Session 2');

        await act(async () => sessions.renameSession(added, 'Easter'));
        expect(sessions.activeSession.name).toBe('Easter');
        expect(readSessions('foreground-image')[1].name).toBe('Easter');
        await act(async () => sessions.removeSession(added));
        expect(sessions.activeId).toBe('');
        expect(sessions.sessions).toEqual([{ id: '', name: 'Default' }]);
    });

    it('draws a session added from outside on every mounted strip of its target only', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(12345);
        expect(genMediaSessionId()).toBe('s9ix');
        let first!: ReturnType<typeof useMediaSessions>;
        let second!: ReturnType<typeof useMediaSessions>;
        let other!: ReturnType<typeof useMediaSessions>;
        function HarnessComp() {
            first = useMediaSessions('foreground-long-text');
            second = useMediaSessions('foreground-long-text');
            other = useMediaSessions('foreground-image');
            return null;
        }
        await act(async () => root.render(<HarnessComp />));
        await act(async () => {
            addMediaSession('foreground-long-text', {
                id: 's1',
                name: 'Still',
            });
        });
        for (const strip of [first, second]) {
            expect(strip.activeId).toBe('s1');
            expect(strip.activeSession.name).toBe('Still');
        }
        expect(other.activeId).toBe('');
        expect(readSessions('foreground-image')).toEqual([
            { id: '', name: 'Default' },
        ]);

        // With no strip mounted the session is still written, for the strip
        // that mounts next to read.
        await act(async () => root.unmount());
        addMediaSession('foreground-long-text', { id: 's2', name: 'Again' });
        expect(readSessions('foreground-long-text').at(-1)).toEqual({
            id: 's2',
            name: 'Again',
        });
        expect(state.settings.get('foreground-long-text-active-session')).toBe(
            's2',
        );
        root = createRoot(container);
    });

    it('renders live states and only removes a session after confirmation', async () => {
        const onChoose = vi.fn();
        const onAdd = vi.fn();
        const onRename = vi.fn();
        const onRemove = vi.fn();
        mocks.showAppInput.mockImplementation(async (_title, input) => {
            input.props.onChange({ target: { value: '  Evening  ' } });
            return true;
        });
        mocks.showAppConfirm
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        const props = {
            target: 'background-image',
            sessions: [
                { id: '', name: 'Default' },
                { id: 's1', name: 'Sunday' },
            ],
            activeId: 's1',
            onChoose,
            onAdd,
            onRename,
            onRemove,
            genRemovedSettingNames: (id: string) => [
                `folder-${id}`,
                `sort-${id}`,
            ],
            genSessionState: (id: string) => ({
                isOnScreen: id === 's1',
                isAutoPlaying: id === 's1',
            }),
        };
        await act(async () => root.render(<MediaSessionsComp {...props} />));
        const chips = container.querySelectorAll<HTMLButtonElement>(
            'button.media-session',
        );
        expect(chips).toHaveLength(3);
        expect(chips[1].getAttribute('aria-pressed')).toBe('true');
        expect(chips[1].getAttribute('aria-label')).toContain('On Screen');
        expect(chips[1].getAttribute('aria-label')).toContain(
            'Slide show is running',
        );
        expect(chips[1].querySelector('.bi-play-fill')).not.toBeNull();
        await act(async () => chips[0].click());
        await act(async () => chips[2].click());
        expect(onChoose).toHaveBeenCalledWith('');
        expect(onAdd).toHaveBeenCalledOnce();

        await act(async () => {
            chips[1].dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const menu = mocks.showAppContextMenu.mock.lastCall?.[1];
        expect(menu.map((item: any) => item.menuElement)).toEqual([
            'Rename Session',
            'Remove Session',
        ]);
        await act(async () => menu[0].onSelect());
        expect(onRename).toHaveBeenCalledWith('s1', 'Evening');
        await act(async () => menu[1].onSelect());
        expect(onRemove).not.toHaveBeenCalled();
        expect(mocks.removeSetting).not.toHaveBeenCalled();
        await act(async () => menu[1].onSelect());
        expect(mocks.removeSetting.mock.calls).toEqual([
            ['folder-s1'],
            ['sort-s1'],
        ]);
        expect(onRemove).toHaveBeenCalledWith('s1');
    });

    it('keeps the last session and refreshes after slide-show state changes', async () => {
        let refresh!: () => void;
        mocks.subscribeSlideAutoPlayState.mockImplementation((callback) => {
            refresh = callback;
            return vi.fn();
        });
        let renders = 0;
        function RefreshComp() {
            useMediaSessionAutoPlayRefresh();
            renders += 1;
            return <span>{renders}</span>;
        }
        await act(async () => root.render(<RefreshComp />));
        expect(mocks.subscribeSlideAutoPlayState).toHaveBeenCalledOnce();
        vi.spyOn(Date, 'now').mockReturnValue(42);
        await act(async () => refresh());
        expect(container.textContent).toBe('2');

        await act(async () =>
            root.render(
                <MediaSessionsComp
                    target="background-image"
                    sessions={[{ id: '', name: 'Default' }]}
                    activeId=""
                    onChoose={vi.fn()}
                    onAdd={vi.fn()}
                    onRename={vi.fn()}
                    onRemove={vi.fn()}
                    genRemovedSettingNames={() => []}
                    genSessionState={() => ({
                        isOnScreen: false,
                        isAutoPlaying: false,
                    })}
                />,
            ),
        );
        const chip = container.querySelector<HTMLButtonElement>(
            'button.media-session',
        )!;
        await act(async () =>
            chip.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(mocks.showAppContextMenu.mock.lastCall?.[1]).toHaveLength(1);
    });
});
