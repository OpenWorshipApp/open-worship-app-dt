// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    sendData: vi.fn(),
    listenForData: vi.fn(),
    removeListener: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: state.sendData,
            listenForData: state.listenForData,
            removeListener: state.removeListener,
        },
    },
}));

import {
    closeFinder,
    findString,
    listenFocusFinder,
    listenFoundInPage,
    markFinderMounted,
    startFinderDragging,
    stopFinderDragging,
    stopFindingString,
} from './finderHelpers';

beforeEach(() => {
    state.sendData.mockReset();
    state.listenForData.mockReset();
    state.removeListener.mockReset();
});

describe('finder commands sent to the main process', () => {
    test('a query is searched with its options', () => {
        findString('grace', { forward: false, findNext: true });
        expect(state.sendData).toHaveBeenCalledExactlyOnceWith(
            'finder:app:search-in-page',
            'grace',
            { forward: false, findNext: true },
        );
        findString('love');
        expect(state.sendData).toHaveBeenLastCalledWith(
            'finder:app:search-in-page',
            'love',
            {},
        );
    });

    test('an empty query stops searching and clears the selection', () => {
        findString('');
        expect(state.sendData).toHaveBeenCalledExactlyOnceWith(
            'finder:app:stop-search-in-page',
            'clearSelection',
        );
    });

    test('stopping can keep or activate the selection', () => {
        stopFindingString('keepSelection');
        stopFindingString('activateSelection');
        expect(state.sendData.mock.calls).toEqual([
            ['finder:app:stop-search-in-page', 'keepSelection'],
            ['finder:app:stop-search-in-page', 'activateSelection'],
        ]);
    });

    test('closing and dragging the bar', () => {
        closeFinder();
        startFinderDragging(42);
        stopFinderDragging();
        expect(state.sendData.mock.calls).toEqual([
            ['finder:app:close'],
            ['finder:app:drag-start', 42],
            ['finder:app:drag-stop'],
        ]);
    });

    test('the bar reports it mounted, and unmounted through what it got back', () => {
        const unmark = markFinderMounted();
        expect(state.sendData).toHaveBeenCalledExactlyOnceWith(
            'finder:app:mounted',
            true,
        );
        unmark();
        expect(state.sendData).toHaveBeenLastCalledWith(
            'finder:app:mounted',
            false,
        );
    });
});

describe('answers from the main process', () => {
    test('match counts reach the handler, and unregistering removes that same listener', () => {
        const handler = vi.fn();
        const unregister = listenFoundInPage(handler);
        expect(state.listenForData).toHaveBeenCalledOnce();
        const [channel, callback] = state.listenForData.mock.calls[0];
        expect(channel).toBe('main:app:found-in-page');
        const result = {
            activeMatchOrdinal: 2,
            matches: 5,
            finalUpdate: true,
        };
        callback({ sender: 'main' }, result);
        expect(handler).toHaveBeenCalledExactlyOnceWith(result);

        unregister();
        expect(state.removeListener).toHaveBeenCalledExactlyOnceWith(
            'main:app:found-in-page',
            callback,
        );
    });

    test('a second Ctrl+F asks the bar to take the focus', () => {
        const handler = vi.fn();
        const unregister = listenFocusFinder(handler);
        const [channel, callback] = state.listenForData.mock.calls[0];
        expect(channel).toBe('main:app:focus-find');
        callback({}, undefined);
        expect(handler).toHaveBeenCalledOnce();
        unregister();
        expect(state.removeListener).toHaveBeenCalledWith(
            'main:app:focus-find',
            callback,
        );
    });
});
