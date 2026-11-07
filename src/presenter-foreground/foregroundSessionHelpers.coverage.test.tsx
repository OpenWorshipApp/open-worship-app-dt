// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ForegroundSessionsPropsType } from './foregroundSessionHelpers';

// A text or timer component's sessions strip: which strip it is, what the
// session in front means for the keys the panel reads, what each chip says,
// and what removing a session takes down and leaves behind.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        initialSessions: [] as { id: string; name: string }[],
        initialActiveId: '',
        // The props the strip was last drawn with.
        stripProps: null as any,
        result: null as any,
    },
    mocks: {
        useMediaSessions: vi.fn(),
        removeSession: vi.fn(),
        addSession: vi.fn(),
        renameSession: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: { listenForData: () => {}, sendData: () => {} },
        appUtils: { handleError: () => {} },
    },
}));
// The strip itself and the hook behind it, kept in React state so a removal
// redraws the panel the way the real setting does.
vi.mock('../media-sessions/MediaSessionsComp', async () => {
    const { useState } = await import('react');
    return {
        DEFAULT_SESSION_ID: '',
        toSessionSuffix: (sessionId: string) => {
            return sessionId === '' ? '' : `-${sessionId}`;
        },
        useMediaSessions: (target: string) => {
            mocks.useMediaSessions(target);
            const [sessions, setSessions] = useState(state.initialSessions);
            const [activeId, setActiveId] = useState(state.initialActiveId);
            return {
                sessions,
                activeId,
                setActiveId,
                addSession: mocks.addSession,
                renameSession: mocks.renameSession,
                removeSession: (sessionId: string) => {
                    mocks.removeSession(sessionId);
                    setSessions((list) => {
                        return list.filter((session) => {
                            return session.id !== sessionId;
                        });
                    });
                },
            };
        },
        default: (props: any) => {
            state.stripProps = props;
            return (
                <span data-target={props.target} data-active={props.activeId}>
                    {props.sessions.map((session: { id: string }) => {
                        const sessionState = props.genSessionState(session.id);
                        return (
                            <i
                                key={session.id}
                                data-session={session.id}
                                data-on-screen={`${sessionState.isOnScreen}`}
                                data-auto-playing={`${sessionState.isAutoPlaying}`}
                            />
                        );
                    })}
                </span>
            );
        },
    };
});
vi.mock('./propertiesSettingHelpers', () => ({
    genPropsSettingNames: (prefix: string) => ({
        width: `${prefix}-width`,
        height: `${prefix}-height`,
    }),
}));
vi.mock('./ForegroundCommonPropertiesSettingComp', () => ({
    genCommonStyleSettingNames: (prefix: string) => ({
        color: `${prefix}-color`,
    }),
}));
vi.mock('./foregroundDecorationHelpers', () => ({
    genDecorationSettingName: (prefix: string) => {
        return `${prefix}-decoration`;
    },
}));

import {
    toForegroundSessionsTarget,
    useForegroundSessions,
} from './foregroundSessionHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.initialSessions = [
        { id: '', name: 'Default' },
        { id: 's2', name: 'Session 2' },
    ];
    state.initialActiveId = 's2';
    state.stripProps = null;
    state.result = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

function HostComp(props: Readonly<ForegroundSessionsPropsType>) {
    const result = useForegroundSessions(props);
    state.result = result;
    return <div>{result.element}</div>;
}

async function render(props: Partial<ForegroundSessionsPropsType> = {}) {
    await act(async () => {
        root.render(
            <HostComp
                widgetKey="countdown"
                checkIsOnScreen={() => {
                    return false;
                }}
                hideSession={() => {}}
                {...props}
            />,
        );
    });
}

function readChips() {
    return Array.from(container.querySelectorAll('[data-session]')).map(
        (chip) => {
            return [
                chip.getAttribute('data-session'),
                chip.getAttribute('data-on-screen'),
                chip.getAttribute('data-auto-playing'),
            ];
        },
    );
}

describe('a foreground component sessions strip', () => {
    test('lives under foreground-<key>, never the bare key', async () => {
        expect(toForegroundSessionsTarget('image')).toBe('foreground-image');
        await render({ widgetKey: 'image' });
        expect(mocks.useMediaSessions).toHaveBeenCalledWith('foreground-image');
        expect(state.stripProps.target).toBe('foreground-image');
    });

    test('the session in front names the suffix and the Properties prefix', async () => {
        await render({
            toPrefix: (suffix) => {
                return `countdown${suffix}`;
            },
        });
        expect(state.result).toMatchObject({
            activeId: 's2',
            sessionIds: ['', 's2'],
            suffix: '-s2',
            prefix: 'countdown-s2',
        });
        expect(
            container
                .querySelector('[data-active]')!
                .getAttribute('data-active'),
        ).toBe('s2');
        // Choosing Default goes back to the keys an install always had.
        await act(async () => {
            state.stripProps.onChoose('');
        });
        expect(state.result).toMatchObject({
            activeId: '',
            suffix: '',
            prefix: 'countdown',
        });
        // Adding and renaming are the strip's own, handed straight through.
        expect(state.stripProps.onAdd).toBe(mocks.addSession);
        expect(state.stripProps.onRename).toBe(mocks.renameSession);
    });

    test('a widget whose Properties are its items has no prefix', async () => {
        await render();
        expect(state.result.prefix).toBe('');
        expect(state.result.suffix).toBe('-s2');
    });

    test('each chip says whether ITS session is on a screen, and none runs a show', async () => {
        const checkIsOnScreen = vi.fn((sessionId: string) => {
            return sessionId === '';
        });
        await render({ checkIsOnScreen });
        expect(readChips()).toEqual([
            ['', 'true', 'false'],
            ['s2', 'false', 'false'],
        ]);
        expect(checkIsOnScreen).toHaveBeenCalledWith('', '', ['', 's2']);
        expect(checkIsOnScreen).toHaveBeenCalledWith('s2', '-s2', ['', 's2']);
    });

    test('removing a session takes its overlay off first, with the strip as it stood', async () => {
        const hideSession = vi.fn();
        await render({ hideSession });
        const onRemove = state.stripProps.onRemove;
        await act(async () => {
            onRemove('s2');
        });
        expect(hideSession).toHaveBeenCalledWith('s2', '-s2', ['', 's2']);
        expect(mocks.removeSession).toHaveBeenCalledWith('s2');
        expect(hideSession.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.removeSession.mock.invocationCallOrder[0],
        );
        expect(state.result.sessionIds).toEqual(['']);
        // The callback the strip holds is the same one, and it reads the
        // panel as it is NOW, not as it was when the strip was first drawn.
        const laterHideSession = vi.fn();
        await render({ hideSession: laterHideSession });
        expect(state.stripProps.onRemove).toBe(onRemove);
        await act(async () => {
            onRemove('');
        });
        expect(laterHideSession).toHaveBeenCalledWith('', '', ['']);
        expect(hideSession).toHaveBeenCalledTimes(1);
    });

    test('a removed session leaves no Properties key and none of the widget own keys', async () => {
        await render({
            toPrefix: (suffix) => {
                return `quick-text${suffix}`;
            },
            toOwnSettingNames: (suffix) => {
                return [`quick-text-words${suffix}`];
            },
        });
        expect(state.stripProps.genRemovedSettingNames('s2')).toEqual([
            'quick-text-s2-width',
            'quick-text-s2-height',
            'quick-text-s2-color',
            'quick-text-s2-decoration',
            'foreground-quick-text-s2-show-properties-setting',
            'quick-text-words-s2',
        ]);
        // A widget with neither has nothing to forget.
        await render({ toPrefix: undefined, toOwnSettingNames: undefined });
        expect(state.stripProps.genRemovedSettingNames('s2')).toEqual([]);
        // Its items' Properties are not the session's: only its own keys go.
        await render({
            toOwnSettingNames: (suffix) => {
                return [`time-list${suffix}`];
            },
        });
        expect(state.stripProps.genRemovedSettingNames('')).toEqual([
            'time-list',
        ]);
    });
});
