// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    getAllLocalBibleInfoList: vi.fn(),
    createBibleItemLyric: vi.fn(),
    getInstance: vi.fn(),
    setSelectedAppDocument: vi.fn(),
    showVaryAppDocument: vi.fn(),
}));

vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        widgetName,
        onClose,
        children,
    }: {
        title: string;
        widgetName: string;
        onClose: () => void;
        children: any;
    }) => (
        <section aria-label={title} data-widget-name={widgetName}>
            <button type="button" className="widget-close" onClick={onClose}>
                x
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useState } = await import('react');
    return {
        useAppStateAsync: (callee: () => unknown, deps: unknown[] = []) => {
            const [value, setValue] = useState<unknown>(undefined);
            useEffect(() => {
                let isAlive = true;
                Promise.resolve(callee()).then((newValue) => {
                    if (isAlive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isAlive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});
vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: h.getAllLocalBibleInfoList,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('./bibleLyricHelpers', () => ({
    createBibleItemLyric: h.createBibleItemLyric,
}));
vi.mock('../lyric-list/LyricAppDocument', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    useSelectedAppDocumentSetterContext: () => h.setSelectedAppDocument,
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: h.showVaryAppDocument },
}));

import BibleLyricPopupComp from './BibleLyricPopupComp';

const BIBLES = [
    { key: 'KJV', title: 'King James', locale: 'en' },
    { key: 'NIV', title: 'New International', locale: 'en' },
    { key: 'XXOV', title: 'Made Up Old Version', locale: 'xx' },
];
const LYRIC_FILE_PATH = '/documents/(KJV) John 3 16.owl';

let host: HTMLDivElement;
let root: Root;
let onClose: Mock<() => void>;
let bibleItem: any;

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((resolve1) => {
        resolve = resolve1;
    });
    return { promise, resolve };
}

async function renderPopup() {
    await act(async () => {
        root.render(
            <BibleLyricPopupComp bibleItem={bibleItem} onClose={onClose} />,
        );
    });
}

function query<T extends Element>(selector: string) {
    return document.body.querySelector<T>(selector);
}

function getButton(text: string) {
    const button = [
        ...document.body.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent === text);
    if (button === undefined) {
        throw new Error(`No button ${text}`);
    }
    return button;
}

function getBibleCheckbox(bibleKey: string) {
    return [...document.body.querySelectorAll('label')]
        .find((label) => label.textContent?.startsWith(`${bibleKey} `))!
        .querySelector<HTMLInputElement>('input')!;
}

async function submit() {
    await act(async () => {
        query('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onClose = vi.fn<() => void>();
    bibleItem = {
        bibleKey: 'KJV',
        toTitleWithBibleKey: vi.fn(async () => '(KJV) John 3:16'),
    };
    h.getAllLocalBibleInfoList.mockResolvedValue(BIBLES);
    h.createBibleItemLyric.mockResolvedValue({ filePath: LYRIC_FILE_PATH });
    h.getInstance.mockImplementation((filePath: string) => ({ filePath }));
    h.setSelectedAppDocument.mockResolvedValue(true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Create Lyric popup', () => {
    test('opens over the page in its theme, titled with the passage, listing the other Bibles', async () => {
        await renderPopup();
        const portal = query<HTMLElement>('.app-floating-widget-portal')!;
        expect(portal.parentElement).toBe(document.body);
        expect(portal.dataset.bsTheme).toBe('light');
        const widget = query<HTMLElement>('section')!;
        expect(widget.getAttribute('aria-label')).toBe('Create Lyric');
        expect(widget.dataset.widgetName).toBe('Create Lyric');
        expect(query('strong')!.textContent).toBe('(KJV) John 3:16');
        // A song has no slide size or theme to choose.
        expect(query('input[type="number"]')).toBeNull();
        expect(query('select')).toBeNull();

        const labels = [...document.body.querySelectorAll('label.p-2')].map(
            (label) => label.textContent,
        );
        // The passage's own Bible is always in, and only listed once.
        expect(labels).toEqual([
            'KJV',
            'NIV — New International',
            'XXOV — Made Up Old Version',
        ]);
        const own =
            document.body.querySelector<HTMLInputElement>('label.p-2 input')!;
        expect([own.checked, own.disabled]).toEqual([true, true]);
        expect(getBibleCheckbox('NIV').checked).toBe(false);
    });

    test('says when the Bibles are loading, and when they cannot be listed', async () => {
        const list = genDeferred<unknown>();
        h.getAllLocalBibleInfoList.mockReturnValue(list.promise);
        await renderPopup();
        expect(query('[role="status"]')!.textContent).toBe('Loading');
        await act(async () => list.resolve(null));
        expect(query('[role="status"]')).toBeNull();
        expect(query('[role="alert"]')!.textContent).toBe(
            'Unable to get bible info list',
        );
    });

    test('creates the song with the Bibles in the order ticked, then selects and shows it', async () => {
        await renderPopup();
        await act(async () => getBibleCheckbox('XXOV').click());
        await act(async () => getBibleCheckbox('NIV').click());
        await act(async () => getBibleCheckbox('XXOV').click());
        await act(async () => getBibleCheckbox('XXOV').click());
        await submit();
        expect(h.createBibleItemLyric).toHaveBeenCalledWith(bibleItem, [
            'KJV',
            'NIV',
            'XXOV',
        ]);
        expect(h.getInstance).toHaveBeenCalledWith(LYRIC_FILE_PATH);
        expect(h.setSelectedAppDocument).toHaveBeenCalledWith({
            filePath: LYRIC_FILE_PATH,
        });
        expect(h.showVaryAppDocument).toHaveBeenCalledWith({
            filePath: LYRIC_FILE_PATH,
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('a song the selection does not take (pinned) is not shown, but the popup still closes', async () => {
        h.setSelectedAppDocument.mockResolvedValue(false);
        await renderPopup();
        await submit();
        expect(h.createBibleItemLyric).toHaveBeenCalledWith(bibleItem, ['KJV']);
        expect(h.showVaryAppDocument).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('a failed run keeps the popup open and usable', async () => {
        h.createBibleItemLyric.mockResolvedValue(null);
        await renderPopup();
        await submit();
        expect(h.getInstance).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(getButton('Create Lyric').disabled).toBe(false);
        expect(getButton('Cancel').disabled).toBe(false);
    });

    test('while creating, everything waits: no second run, no closing', async () => {
        const creation = genDeferred<unknown>();
        h.createBibleItemLyric.mockReturnValue(creation.promise);
        await renderPopup();
        await submit();
        expect(query('.spinner-border')).not.toBeNull();
        expect(getButton('Cancel').disabled).toBe(true);
        expect(getBibleCheckbox('NIV').disabled).toBe(true);

        await submit();
        expect(h.createBibleItemLyric).toHaveBeenCalledTimes(1);
        await act(async () =>
            query<HTMLButtonElement>('.widget-close')!.click(),
        );
        expect(onClose).not.toHaveBeenCalled();

        await act(async () => creation.resolve(null));
        expect(query('.spinner-border')).toBeNull();
        expect(getBibleCheckbox('NIV').disabled).toBe(false);
        await act(async () => getButton('Cancel').click());
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(h.createBibleItemLyric).toHaveBeenCalledTimes(1);
    });
});
