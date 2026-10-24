// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    activeId: '' as string,
    sessionProps: null as null | Record<string, any>,
    setActiveId: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    renameSession: vi.fn(),
    runners: vi.fn(),
    runningKeys: [] as string[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../media-sessions/MediaSessionsComp', () => ({
    default: (props: Record<string, any>) => {
        state.sessionProps = props;
        return <div>Sessions: {props.activeId || 'default'}</div>;
    },
    toSessionSuffix: (sessionId: string) =>
        sessionId === '' ? '' : `--${sessionId}`,
    useMediaSessionAutoPlayRefresh: () => undefined,
    useMediaSessions: () => ({
        sessions: [{ id: '' }, { id: 'evening' }],
        activeId: state.activeId,
        setActiveId: state.setActiveId,
        addSession: state.addSession,
        removeSession: state.removeSession,
        renameSession: state.renameSession,
    }),
}));
vi.mock('../others/fileListFilterHelpers', () => ({
    toFilterTypeSettingName: (key: string) => `filter:${key}`,
    toSortSettingName: (key: string) => `sort:${key}`,
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    applyAutoPlayRunners: state.runners,
    getRunningAutoPlayKeys: () => state.runningKeys,
}));
vi.mock('../slide-auto-play/slideAutoPlayHelpers', () => ({
    genSlideAutoPlaySettingNames: (key: string) => [
        `playing:${key}`,
        `delay:${key}`,
    ],
}));
vi.mock('./BackgroundViewModeComp', () => ({
    toBackgroundViewModeSettingName: (key: string) => `view:${key}`,
}));

import {
    useBackgroundSessions,
    type BackgroundSessionsPropsType,
} from './backgroundSessionHelpers';

let host: HTMLDivElement;
let root: Root;
let current: ReturnType<typeof useBackgroundSessions>;

function Harness(props: BackgroundSessionsPropsType) {
    current = useBackgroundSessions(props);
    return <>{current.element}</>;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.activeId = '';
    state.sessionProps = null;
    state.runningKeys = ['background-image--evening'];
    state.setActiveId.mockReset();
    state.addSession.mockReset();
    state.removeSession.mockReset();
    state.renameSession.mockReset();
    state.runners.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('background folder sessions', () => {
    it('preserves default setting names and reports a hidden session show', async () => {
        await act(async () =>
            root.render(
                <Harness
                    target="background-image"
                    dirSourceSettingName="select-dir-images"
                    autoPlayPrefix="background-image"
                />,
            ),
        );
        expect(current.activeId).toBe('');
        expect(current.dirSourceSettingName).toBe('select-dir-images');
        expect(current.autoPlayPrefix).toBe('background-image');
        expect(state.sessionProps!.genSessionState('evening')).toEqual({
            isOnScreen: false,
            isAutoPlaying: true,
        });
        expect(state.sessionProps!.genRemovedSettingNames('evening')).toEqual([
            'select-dir-images--evening',
            'view:select-dir-images--evening',
            'sort:select-dir-images--evening',
            'filter:select-dir-images--evening',
            'playing:background-image--evening',
            'delay:background-image--evening',
        ]);

        state.activeId = 'evening';
        await act(async () =>
            root.render(
                <Harness
                    target="background-image"
                    dirSourceSettingName="select-dir-images"
                    autoPlayPrefix="background-image"
                />,
            ),
        );
        expect(current.dirSourceSettingName).toBe('select-dir-images--evening');
        expect(current.autoPlayPrefix).toBe('background-image--evening');
    });

    it('refuses every session switch while the current media is playing', async () => {
        const checkCanChangeSession = vi.fn().mockReturnValue(false);
        await act(async () =>
            root.render(
                <Harness
                    target="background-audio"
                    dirSourceSettingName="select-dir-audios"
                    checkCanChangeSession={checkCanChangeSession}
                />,
            ),
        );
        state.sessionProps!.onChoose('evening');
        state.sessionProps!.onAdd();
        state.sessionProps!.onRemove('evening');
        expect(checkCanChangeSession).toHaveBeenCalledTimes(3);
        expect(state.setActiveId).not.toHaveBeenCalled();
        expect(state.addSession).not.toHaveBeenCalled();
        expect(state.removeSession).not.toHaveBeenCalled();
        expect(state.runners).not.toHaveBeenCalled();
        expect(current.autoPlayPrefix).toBeUndefined();
        expect(state.sessionProps!.genRemovedSettingNames('evening')).toEqual([
            'select-dir-audios--evening',
            'view:select-dir-audios--evening',
            'sort:select-dir-audios--evening',
            'filter:select-dir-audios--evening',
        ]);
    });

    it('stops only a removed session show before removing its settings', async () => {
        await act(async () =>
            root.render(
                <Harness
                    target="background-image"
                    dirSourceSettingName="select-dir-images"
                    autoPlayPrefix="background-image"
                />,
            ),
        );
        state.sessionProps!.onChoose('evening');
        state.sessionProps!.onAdd();
        state.sessionProps!.onRemove('evening');
        expect(state.setActiveId).toHaveBeenCalledWith('evening');
        expect(state.addSession).toHaveBeenCalledOnce();
        expect(state.runners.mock.lastCall![0]).toEqual([]);
        expect(
            state.runners.mock.lastCall![1]('background-image--evening'),
        ).toBe(true);
        expect(state.runners.mock.lastCall![1]('background-video')).toBe(false);
        expect(state.removeSession).toHaveBeenCalledWith('evening');
    });
});
