// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// "This note file's editing head just changed": said by the window that
// changed it, heard by every other window through main.
const { messageUtils, listenerMap } = vi.hoisted(() => {
    const listenerMap = new Map<string, Set<(...args: any[]) => void>>();
    return {
        listenerMap,
        messageUtils: {
            sendData: vi.fn(),
            listenForData: vi.fn(
                (channel: string, listener: (...args: any[]) => void) => {
                    const set = listenerMap.get(channel) ?? new Set();
                    set.add(listener);
                    listenerMap.set(channel, set);
                },
            ),
            removeListener: vi.fn(
                (channel: string, listener: (...args: any[]) => void) => {
                    listenerMap.get(channel)?.delete(listener);
                },
            ),
        },
    };
});

vi.mock('../../server/appProvider', () => ({
    default: { messageUtils },
}));

import {
    notifyNoteHeadChanged,
    registerNoteHeadChangedListener,
} from './noteHeadChangeHelpers';

const RENDERER_CHANNEL = 'main:app:note-head-changed';

function emit(data?: unknown) {
    for (const listener of listenerMap.get(RENDERER_CHANNEL) ?? []) {
        listener({}, data);
    }
}

beforeEach(() => {
    listenerMap.clear();
    messageUtils.listenForData.mockImplementation((channel, listener) => {
        const set = listenerMap.get(channel) ?? new Set();
        set.add(listener);
        listenerMap.set(channel, set);
    });
    messageUtils.removeListener.mockImplementation((channel, listener) => {
        listenerMap.get(channel)?.delete(listener);
    });
});

describe('noteHeadChangeHelpers', () => {
    test('a change is broadcast to every window with its file', () => {
        notifyNoteHeadChanged('C:\\notes\\Default.own');

        expect(messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:note-head-changed',
            { filePath: 'C:\\notes\\Default.own' },
        );
    });

    test('a listener hears the file of each change, and nothing that names none', () => {
        const handler = vi.fn();
        registerNoteHeadChangedListener(handler);

        emit({ filePath: 'C:\\notes\\Default.own' });
        emit({ filePath: 42 });
        emit({});
        emit();

        expect(handler.mock.calls).toEqual([['C:\\notes\\Default.own']]);
    });

    test('unregistering stops it hearing, and only it', () => {
        const kept = vi.fn();
        const dropped = vi.fn();
        registerNoteHeadChangedListener(kept);
        const unregister = registerNoteHeadChangedListener(dropped);

        unregister();
        emit({ filePath: 'C:\\notes\\A.own' });

        expect(messageUtils.removeListener).toHaveBeenCalledWith(
            RENDERER_CHANNEL,
            expect.any(Function),
        );
        expect(dropped).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalledWith('C:\\notes\\A.own');
    });
});
