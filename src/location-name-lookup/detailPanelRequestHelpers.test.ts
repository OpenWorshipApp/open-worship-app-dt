import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    sendData: vi.fn(),
    listenForData: vi.fn(),
    removeListener: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: h.sendData,
            listenForData: h.listenForData,
            removeListener: h.removeListener,
        },
    },
}));

import {
    DETAIL_PANEL_RENDERER_CHANNEL,
    DETAIL_PANEL_REQUEST_CHANNEL,
    registerDetailPanelRequestListener,
    requestDetailPanelInReader,
    toValidDetailPanelRequest,
} from './detailPanelRequestHelpers';

const EZEKIEL = {
    kind: 'verse',
    target: 'EZK 36:25-27',
    name: 'Ezek. 36:25-27',
    bibleKey: 'KJV',
} as const;

beforeEach(() => {
    h.sendData.mockReset();
    h.listenForData.mockReset();
    h.removeListener.mockReset();
});

describe('toValidDetailPanelRequest', () => {
    test('keeps the four fields, trimmed, and nothing else', () => {
        expect(
            toValidDetailPanelRequest({
                ...EZEKIEL,
                name: '  Ezek. 36:25-27 ',
                html: '<img onerror=x>',
            }),
        ).toEqual(EZEKIEL);
    });

    test('drops a Bible from a person or a place', () => {
        expect(
            toValidDetailPanelRequest({
                kind: 'location',
                target: 'egypt_1',
                name: 'Egypt',
                bibleKey: 'KJV',
            }),
        ).toEqual({ kind: 'location', target: 'egypt_1', name: 'Egypt' });
    });

    test('refuses a wrong kind, an empty or oversized field', () => {
        for (const data of [
            undefined,
            [],
            { ...EZEKIEL, kind: 'file' },
            { ...EZEKIEL, target: '' },
            { ...EZEKIEL, name: 'n'.repeat(201) },
            { ...EZEKIEL, bibleKey: '' },
            { ...EZEKIEL, bibleKey: 'k'.repeat(101) },
        ]) {
            expect(toValidDetailPanelRequest(data)).toBeNull();
        }
    });
});

describe('requestDetailPanelInReader', () => {
    test('sends a checked request to main', () => {
        expect(requestDetailPanelInReader(EZEKIEL)).toBe(true);
        expect(h.sendData).toHaveBeenCalledExactlyOnceWith(
            DETAIL_PANEL_REQUEST_CHANNEL,
            EZEKIEL,
        );
    });

    test('sends nothing it would refuse', () => {
        expect(requestDetailPanelInReader({ ...EZEKIEL, target: ' ' })).toBe(
            false,
        );
        expect(h.sendData).not.toHaveBeenCalled();
    });
});

describe('registerDetailPanelRequestListener', () => {
    test('hands on a checked request and unregisters the same listener', () => {
        const handler = vi.fn();
        const unregister = registerDetailPanelRequestListener(handler);
        const [channel, listener] = h.listenForData.mock.calls[0];
        expect(channel).toBe(DETAIL_PANEL_RENDERER_CHANNEL);

        listener({}, { kind: 'name' });
        expect(handler).not.toHaveBeenCalled();
        listener({}, EZEKIEL);
        expect(handler).toHaveBeenCalledExactlyOnceWith(EZEKIEL);

        unregister();
        expect(h.removeListener).toHaveBeenCalledExactlyOnceWith(
            DETAIL_PANEL_RENDERER_CHANNEL,
            listener,
        );
    });
});
