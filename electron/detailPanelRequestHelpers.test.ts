import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({}));
// The renderer module sends through it; only its channel names are read here.
vi.mock('../src/server/appProvider', () => ({ default: {} }));

import {
    DETAIL_PANEL_RENDERER_CHANNEL as RENDERER_LISTEN_CHANNEL,
    DETAIL_PANEL_REQUEST_CHANNEL as RENDERER_SEND_CHANNEL,
} from '../src/location-name-lookup/detailPanelRequestHelpers';
import {
    DETAIL_PANEL_RENDERER_CHANNEL,
    DETAIL_PANEL_REQUEST_CHANNEL,
    openDetailPanelInReader,
    pickDetailPanelWindow,
    toValidDetailPanelRequest,
} from './detailPanelRequestHelpers';

const HOST = 'https://localhost:3000';
const PRESENTER_URL = `${HOST}/presenter.html`;
const READER_URL = `${HOST}/reader.html`;
const READER_POPUP_URL = `${HOST}/reader.html?uuid=reader`;
const PREVIEW_URL = `${HOST}/markdownPreview.html?preview-file=x.md`;

function genWin(url: string, options: { isMinimized?: boolean } = {}) {
    return {
        url,
        isDestroyed: () => false,
        isMinimized: () => options.isMinimized === true,
        restore: vi.fn(),
        show: vi.fn(),
        focus: vi.fn(),
        webContents: {
            isDestroyed: () => false,
            getURL: () => url,
            send: vi.fn(),
        },
    };
}

const MOSES = { kind: 'name', target: 'moses_2108', name: 'Moses' } as const;

describe('the channels', () => {
    it('are the ones the renderer sends on and listens on', () => {
        expect(DETAIL_PANEL_REQUEST_CHANNEL).toBe(RENDERER_SEND_CHANNEL);
        expect(DETAIL_PANEL_RENDERER_CHANNEL).toBe(RENDERER_LISTEN_CHANNEL);
    });
});

describe('toValidDetailPanelRequest', () => {
    it('keeps a person, a place and a verse with its Bible', () => {
        expect(toValidDetailPanelRequest(MOSES)).toEqual(MOSES);
        expect(
            toValidDetailPanelRequest({
                kind: 'verse',
                target: 'EZK 36:25-27',
                name: 'Ezek. 36:25-27',
                bibleKey: 'KJV',
                extra: 'dropped',
            }),
        ).toEqual({
            kind: 'verse',
            target: 'EZK 36:25-27',
            name: 'Ezek. 36:25-27',
            bibleKey: 'KJV',
        });
    });

    it('lets a Bible go with a verse only', () => {
        expect(
            toValidDetailPanelRequest({ ...MOSES, bibleKey: 'KJV' }),
        ).toEqual(MOSES);
    });

    it('refuses anything else', () => {
        for (const data of [
            null,
            'moses',
            { ...MOSES, kind: 'script' },
            { ...MOSES, target: '' },
            { ...MOSES, target: '  ' },
            { ...MOSES, target: 'x'.repeat(201) },
            { ...MOSES, name: 7 },
            { ...MOSES, kind: 'verse', bibleKey: 'k'.repeat(101) },
            { ...MOSES, kind: 'verse', bibleKey: 3 },
        ]) {
            expect(toValidDetailPanelRequest(data)).toBeNull();
        }
    });
});

describe('pickDetailPanelWindow', () => {
    it('takes the main window when it shows the Reader', () => {
        expect(
            pickDetailPanelWindow([
                { win: 'popup', url: READER_POPUP_URL, isMain: false },
                { win: 'main', url: READER_URL, isMain: true },
            ]),
        ).toBe('main');
    });

    it('takes a Reader window over a main window on another page', () => {
        expect(
            pickDetailPanelWindow([
                { win: 'main', url: PRESENTER_URL, isMain: true },
                { win: 'preview', url: PREVIEW_URL, isMain: false },
                { win: 'popup', url: READER_POPUP_URL, isMain: false },
            ]),
        ).toBe('popup');
    });

    it('else keeps to the main window on its own page', () => {
        expect(
            pickDetailPanelWindow([
                { win: 'preview', url: PREVIEW_URL, isMain: false },
                { win: 'main', url: PRESENTER_URL, isMain: true },
            ]),
        ).toBe('main');
        // A name only looking like the page is not the page.
        expect(
            pickDetailPanelWindow([
                { win: 'main', url: PRESENTER_URL, isMain: true },
                {
                    win: 'fake',
                    url: `${HOST}/x/reader.html.md`,
                    isMain: false,
                },
            ]),
        ).toBe('main');
        expect(pickDetailPanelWindow([])).toBeNull();
    });
});

describe('openDetailPanelInReader', () => {
    it('brings the chosen window forward and hands it the request', () => {
        const mainWin = genWin(PRESENTER_URL, { isMinimized: true });
        const readerWin = genWin(READER_POPUP_URL);
        const previewWin = genWin(PREVIEW_URL);
        const isSent = openDetailPanelInReader(
            { ...MOSES, name: 'Moses' },
            mainWin as never,
            [mainWin, previewWin, readerWin] as never,
        );
        expect(isSent).toBe(true);
        expect(readerWin.show).toHaveBeenCalledOnce();
        expect(readerWin.focus).toHaveBeenCalledOnce();
        expect(readerWin.webContents.send).toHaveBeenCalledExactlyOnceWith(
            DETAIL_PANEL_RENDERER_CHANNEL,
            MOSES,
        );
        expect(mainWin.webContents.send).not.toHaveBeenCalled();
        expect(previewWin.webContents.send).not.toHaveBeenCalled();
    });

    it('restores a minimised main window', () => {
        const mainWin = genWin(PRESENTER_URL, { isMinimized: true });
        openDetailPanelInReader(MOSES, mainWin as never, [mainWin] as never);
        expect(mainWin.restore).toHaveBeenCalledOnce();
        expect(mainWin.webContents.send).toHaveBeenCalledOnce();
    });

    it('sends nothing for a forged request', () => {
        const mainWin = genWin(READER_URL);
        expect(
            openDetailPanelInReader(
                { kind: 'eval', target: 'x', name: 'x' },
                mainWin as never,
                [mainWin] as never,
            ),
        ).toBe(false);
        expect(mainWin.focus).not.toHaveBeenCalled();
        expect(mainWin.webContents.send).not.toHaveBeenCalled();
    });

    it('skips a closed window', () => {
        const mainWin = genWin(PRESENTER_URL);
        const goneReaderWin = {
            ...genWin(READER_POPUP_URL),
            isDestroyed: () => true,
        };
        openDetailPanelInReader(
            MOSES,
            mainWin as never,
            [goneReaderWin, mainWin] as never,
        );
        expect(goneReaderWin.webContents.send).not.toHaveBeenCalled();
        expect(mainWin.webContents.send).toHaveBeenCalledOnce();
    });
});
