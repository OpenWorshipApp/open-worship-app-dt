// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Public Domain Songs popup end to end: the REAL embedded catalog, the
// real filter and the real song-to-markdown mapping, down to the one call
// that would write a file (`Lyric.createWithContent`), which is faked — as
// are the folder behind `FileSource`, the toasts and the floating frame.
const { mocks, state } = vi.hoisted(() => ({
    mocks: {
        createWithContent: vi.fn(),
        genNextFilePath: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
    },
    state: { theme: 'light' },
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            name: filePath
                .split('/')
                .at(-1)!
                .replace(/\.[^.]+$/, ''),
            genNextFilePath: () => mocks.genNextFilePath(filePath),
        }),
    },
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => mocks.handleError(...args),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) => {
        return mimetypeName === 'lyric' ? ['owl'] : [];
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
    // The part of the shared rule these titles meet: what Windows refuses
    // goes, the rest is kept as typed.
    toPortableFileName: (name: string, fallbackName: string) => {
        return (
            name
                .replace(/[<>:"/\\|?*]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim() || fallbackName
        );
    },
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: (...args: any[]) => mocks.showSimpleToast(...args),
}));
vi.mock('../../lyric-list/Lyric', () => ({
    default: {
        createWithContent: (...args: any[]) => mocks.createWithContent(...args),
    },
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div>Loading</div>,
}));
vi.mock('../../app-modal/FloatingWidgetComp', () => ({
    default: ({ title, persistKey, onClose, options, children }: any) => (
        <section
            role="dialog"
            aria-label={title}
            data-persist-key={persistKey}
            data-size={`${options.width}x${options.height}`}
        >
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: state.theme }),
}));

import { publicDomainSongCatalog } from './publicDomainSongsData';
import type { PublicDomainSongType } from './publicDomainSongsData';
import PublicDomainSongItemComp from './PublicDomainSongItemComp';
import PublicDomainSongsPanelComp from './PublicDomainSongsPanelComp';
import PublicDomainSongsPopupComp from './PublicDomainSongsPopupComp';
import { importPublicDomainSongToDirectory } from './publicDomainSongsImportHelpers';

const IMPORT_TITLE = 'Import From Public Domain Songs';
const CATALOG_SIZE = publicDomainSongCatalog.length;

let host: HTMLDivElement;
let root: Root;
let fireUpdateEvent: ReturnType<typeof vi.fn>;

function getCatalogSong(id: string) {
    const song = publicDomainSongCatalog.find((item) => item.id === id);
    expect(song, id).toBeDefined();
    return song!;
}

function getSearchInput() {
    return host.querySelector<HTMLInputElement>('input[type="text"]')!;
}

async function typeQuery(value: string) {
    const input = getSearchInput();
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function getListedTitles() {
    return [...host.querySelectorAll('li strong')].map((element) => {
        return element.textContent;
    });
}

function getCountText() {
    const groupTexts = host.querySelectorAll('.input-group-text');
    return groupTexts[groupTexts.length - 1].textContent;
}

function getDownloadButtons() {
    return [
        ...host.querySelectorAll<HTMLButtonElement>(
            'button[aria-label^="Download: "]',
        ),
    ];
}

function getDownloadButton(title: string) {
    const button = host.querySelector<HTMLButtonElement>(
        `button[aria-label="Download: ${title}"]`,
    );
    expect(button, `download ${title}`).not.toBeNull();
    return button!;
}

async function renderPanel() {
    await act(async () => {
        root.render(<PublicDomainSongsPanelComp dirPath="/songs" />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    fireUpdateEvent = vi.fn();
    // Nothing of that name in the folder yet: the name is kept.
    mocks.genNextFilePath.mockImplementation(async (filePath: string) => {
        return filePath;
    });
    mocks.createWithContent.mockImplementation(async () => {
        return { fireUpdateEvent };
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    state.theme = 'light';
    vi.unstubAllGlobals();
});

describe('PublicDomainSongsPanelComp', () => {
    test('lists the whole catalog with each song’s authors, year and first line', async () => {
        await renderPanel();
        expect(getListedTitles()).toEqual(
            publicDomainSongCatalog.map((song) => song.title),
        );
        expect(getCountText()).toBe(String(CATALOG_SIZE));
        expect(getSearchInput().placeholder).toBe('Search songs...');
        // No query, nothing to clear.
        expect(host.querySelector('[aria-label="Clear search"]')).toBeNull();

        const amazingGrace = getDownloadButton('Amazing Grace').closest('li')!;
        const rows = amazingGrace.querySelectorAll('small');
        expect(rows[0].textContent).toBe('John Newton · 1779');
        expect(rows[1].textContent).toBe(
            getCatalogSong('amazing-grace').verses[0].split('\n')[0],
        );
        // Every button says which song it would import.
        expect(getDownloadButtons()).toHaveLength(CATALOG_SIZE);
        expect(getDownloadButton('Amazing Grace').title).toBe(
            'Download: Amazing Grace',
        );
    });

    test('filters by every word, over titles and authors, and clears back', async () => {
        await renderPanel();
        await typeQuery('crosby');
        expect(getListedTitles()).toEqual([
            'Blessed Assurance',
            'Pass Me Not, O Gentle Savior',
            'To God Be the Glory',
        ]);
        expect(getCountText()).toBe('3');

        // Each word must match, in any order and any case.
        await typeQuery('GLORY   crosby');
        expect(getListedTitles()).toEqual(['To God Be the Glory']);

        await typeQuery('zzz-no-such-hymn');
        expect(host.querySelector('ul')).toBeNull();
        expect(host.textContent).toContain('No matches');
        expect(getCountText()).toBe('0');

        await act(async () => {
            host.querySelector<HTMLButtonElement>(
                '[aria-label="Clear search"]',
            )!.click();
        });
        expect(getSearchInput().value).toBe('');
        expect(getListedTitles()).toHaveLength(CATALOG_SIZE);
        expect(host.querySelector('[aria-label="Clear search"]')).toBeNull();
    });

    test('a download imports the song and holds every button until it is done', async () => {
        let finishCreate!: (fileSource: any) => void;
        mocks.createWithContent.mockImplementation(() => {
            return new Promise((resolve) => {
                finishCreate = resolve;
            });
        });
        await renderPanel();
        await act(async () => getDownloadButton('Amazing Grace').click());

        const busyButton = getDownloadButton('Amazing Grace');
        expect(
            busyButton.querySelector('.spinner-border[role="status"]'),
        ).not.toBeNull();
        expect(getDownloadButtons().every((button) => button.disabled)).toBe(
            true,
        );
        expect(
            getDownloadButton('Abide with Me').querySelector(
                '.bi-cloud-download',
            ),
        ).not.toBeNull();
        // The real mapping, written under the song's own title.
        expect(mocks.createWithContent).toHaveBeenCalledTimes(1);
        const [dirPath, name, markdown] = mocks.createWithContent.mock.calls[0];
        expect(dirPath).toBe('/songs');
        expect(name).toBe('Amazing Grace');
        expect(markdown).toContain('# Amazing Grace');
        expect(markdown).toContain('- Artist: John Newton');
        expect(markdown).toContain('- Copyright: Public Domain (1779)');
        expect(markdown).toContain('- Structure: V1V2V3V4');

        await act(async () => finishCreate({ fireUpdateEvent }));
        expect(fireUpdateEvent).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            IMPORT_TITLE,
            'Lyric document created successfully',
        );
        expect(getDownloadButtons().some((button) => button.disabled)).toBe(
            false,
        );
        expect(busyButton.querySelector('.spinner-border')).toBeNull();
    });

    test('a failed import frees the buttons again', async () => {
        mocks.createWithContent.mockResolvedValue(null);
        await renderPanel();
        await act(async () => getDownloadButton('Rock of Ages').click());
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            IMPORT_TITLE,
            'Failed to create lyric document',
        );
        expect(getDownloadButtons().some((button) => button.disabled)).toBe(
            false,
        );
    });
});

describe('PublicDomainSongItemComp', () => {
    test('a song without a year or verses shows only its authors', async () => {
        const song: PublicDomainSongType = {
            id: 'untitled',
            title: 'Untitled Hymn',
            authors: ['Anonymous', 'A. Translator'],
            year: '',
            sources: [],
            verses: [],
            refrain: null,
        };
        const onDownload = vi.fn();
        await act(async () => {
            root.render(
                <PublicDomainSongItemComp
                    song={song}
                    isDownloading={false}
                    isDownloadDisabled={false}
                    onDownload={onDownload}
                />,
            );
        });
        const rows = host.querySelectorAll('small');
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toBe('Anonymous, A. Translator');
        await act(async () => getDownloadButton('Untitled Hymn').click());
        expect(onDownload).toHaveBeenCalledTimes(1);

        // Disabled by another song's download, without a spinner of its own.
        await act(async () => {
            root.render(
                <PublicDomainSongItemComp
                    song={song}
                    isDownloading={false}
                    isDownloadDisabled
                    onDownload={onDownload}
                />,
            );
        });
        const button = getDownloadButton('Untitled Hymn');
        expect(button.disabled).toBe(true);
        expect(button.querySelector('.spinner-border')).toBeNull();
    });
});

describe('importPublicDomainSongToDirectory', () => {
    test('a repeated import lands beside the first under the next free name', async () => {
        mocks.genNextFilePath.mockImplementation(async (filePath: string) => {
            return filePath.replace(/\.owl$/, ' (1).owl');
        });
        const song = getCatalogSong('blessed-assurance');
        await expect(
            importPublicDomainSongToDirectory('/songs', song),
        ).resolves.toBe(true);
        expect(mocks.genNextFilePath).toHaveBeenCalledExactlyOnceWith(
            '/songs/Blessed Assurance.owl',
        );
        const [, name, markdown] = mocks.createWithContent.mock.calls[0];
        expect(name).toBe('Blessed Assurance (1)');
        // The refrain is declared once and sung after every verse.
        expect(markdown).toContain('- Structure: V1CV2CV3C');
        expect(markdown).toContain('```ol:Chorus');
    });

    test('a title Windows would refuse is made portable for the file name', async () => {
        const song = getCatalogSong('hark-the-herald-angels-sing');
        await importPublicDomainSongToDirectory('/songs', {
            ...song,
            title: 'Hark: The Herald? Angels Sing',
        });
        expect(mocks.genNextFilePath).toHaveBeenCalledWith(
            '/songs/Hark The Herald Angels Sing.owl',
        );
    });

    test('a song with no verses is refused before anything is written', async () => {
        await expect(
            importPublicDomainSongToDirectory('/songs', {
                ...getCatalogSong('amazing-grace'),
                verses: ['   ', ''],
            }),
        ).resolves.toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            IMPORT_TITLE,
            'This song has no lyrics to import',
        );
        expect(mocks.genNextFilePath).not.toHaveBeenCalled();
        expect(mocks.createWithContent).not.toHaveBeenCalled();
    });

    test('a folder that cannot be read is reported, not thrown', async () => {
        const error = new Error('EACCES');
        mocks.genNextFilePath.mockRejectedValue(error);
        await expect(
            importPublicDomainSongToDirectory(
                '/songs',
                getCatalogSong('amazing-grace'),
            ),
        ).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            IMPORT_TITLE,
            'Failed to create lyric document',
        );
        expect(mocks.createWithContent).not.toHaveBeenCalled();
    });
});

describe('PublicDomainSongsPopupComp', () => {
    test('floats the catalog over the page, in the app theme, and closes', async () => {
        state.theme = 'dark';
        const onClose = vi.fn();
        await act(async () => {
            root.render(
                <PublicDomainSongsPopupComp
                    dirPath="/songs"
                    onClose={onClose}
                />,
            );
        });
        // The panel, and the catalog with it, is fetched only now.
        for (let round = 0; round < 3; round++) {
            await act(async () => {
                await vi.dynamicImportSettled();
            });
        }
        expect(host.childElementCount).toBe(0);
        const portal = document.body.querySelector<HTMLElement>(
            ':scope > .app-floating-widget-portal',
        )!;
        expect(portal.dataset.bsTheme).toBe('dark');
        const dialog = portal.querySelector('[role="dialog"]')!;
        expect(dialog.getAttribute('aria-label')).toBe(IMPORT_TITLE);
        expect(dialog.getAttribute('data-persist-key')).toBe(
            'floating-widget-rect-public-domain-songs-import',
        );
        expect(dialog.getAttribute('data-size')).toBe('480x600');
        expect(dialog.querySelectorAll('li')).toHaveLength(CATALOG_SIZE);

        await act(async () => {
            [...dialog.querySelectorAll('button')]
                .find((button) => button.textContent === 'Close widget')!
                .click();
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
