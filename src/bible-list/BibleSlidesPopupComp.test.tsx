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
    generateBibleItemSlides: vi.fn(),
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
vi.mock('./bibleSlidesHelpers', () => ({
    generateBibleItemSlides: h.generateBibleItemSlides,
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    useSelectedAppDocumentSetterContext: () => h.setSelectedAppDocument,
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: h.showVaryAppDocument },
}));

import BibleSlidesPopupComp from './BibleSlidesPopupComp';

const BIBLES = [
    { key: 'KJV', title: 'King James', locale: 'en' },
    { key: 'NIV', title: 'New International', locale: 'en' },
    { key: 'KHOV', title: 'Khmer Old Version', locale: 'km' },
];

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
            <BibleSlidesPopupComp bibleItem={bibleItem} onClose={onClose} />,
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

async function typeFontSize(value: string) {
    const input = query<HTMLInputElement>('input[type="number"]')!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return input;
}

async function chooseTheme(value: string) {
    const select = query<HTMLSelectElement>('select')!;
    await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
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
        toTitleWithBibleKey: vi.fn(async () => 'John 3:16 (KJV)'),
    };
    h.getAllLocalBibleInfoList.mockResolvedValue(BIBLES);
    h.generateBibleItemSlides.mockResolvedValue({
        filePath: '/slides/John 3.16.slides',
    });
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

describe('Generate Slides popup', () => {
    test('opens over the page in its theme, titled with the passage, listing the other Bibles', async () => {
        await renderPopup();
        const portal = query<HTMLElement>('.app-floating-widget-portal')!;
        expect(portal.parentElement).toBe(document.body);
        expect(portal.dataset.bsTheme).toBe('light');
        const widget = query<HTMLElement>('section')!;
        expect(widget.getAttribute('aria-label')).toBe('Generate Slides');
        expect(widget.dataset.widgetName).toBe('Generate Slides');
        expect(query('strong')!.textContent).toBe('John 3:16 (KJV)');

        const labels = [...document.body.querySelectorAll('label.p-2')].map(
            (label) => label.textContent,
        );
        // The passage's own Bible is always in, and only listed once.
        expect(labels).toEqual([
            'KJV',
            'NIV — New International',
            'KHOV — Khmer Old Version',
        ]);
        const own =
            document.body.querySelector<HTMLInputElement>('label.p-2 input')!;
        expect(own.checked).toBe(true);
        expect(own.disabled).toBe(true);
        expect(getBibleCheckbox('NIV').checked).toBe(false);
        expect(
            getBibleCheckbox('KHOV').closest('label')!.dataset.localeFf,
        ).toBe('km');
        expect(query('[role="status"]')).toBeNull();
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

    test('generates slides with the chosen Bibles, size and theme, then shows the new document', async () => {
        await renderPopup();
        await act(async () => getBibleCheckbox('KHOV').click());
        await act(async () => getBibleCheckbox('NIV').click());
        await act(async () => getBibleCheckbox('KHOV').click());
        await typeFontSize('64');
        await chooseTheme('light');
        await submit();
        expect(h.generateBibleItemSlides).toHaveBeenCalledWith(
            bibleItem,
            ['KJV', 'NIV'],
            { fontSize: 64, theme: 'light' },
        );
        expect(h.getInstance).toHaveBeenCalledWith('/slides/John 3.16.slides');
        expect(h.setSelectedAppDocument).toHaveBeenCalledWith({
            filePath: '/slides/John 3.16.slides',
        });
        expect(h.showVaryAppDocument).toHaveBeenCalledWith({
            filePath: '/slides/John 3.16.slides',
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('an empty size is Auto, and the theme starts dark', async () => {
        await renderPopup();
        expect(query<HTMLSelectElement>('select')!.value).toBe('dark');
        await submit();
        expect(h.generateBibleItemSlides).toHaveBeenLastCalledWith(
            bibleItem,
            ['KJV'],
            { fontSize: undefined, theme: 'dark' },
        );
        // ...and choosing Dark again after Light is Dark.
        await chooseTheme('light');
        await chooseTheme('dark');
        await submit();
        expect(h.generateBibleItemSlides).toHaveBeenLastCalledWith(
            bibleItem,
            ['KJV'],
            { fontSize: undefined, theme: 'dark' },
        );
    });

    test('a size that is not a positive number cannot be submitted', async () => {
        await renderPopup();
        const generate = getButton('Generate Slides');
        await typeFontSize('0');
        expect(generate.disabled).toBe(true);
        await submit();
        expect(h.generateBibleItemSlides).not.toHaveBeenCalled();
        await typeFontSize('12.5');
        expect(generate.disabled).toBe(false);
    });

    test('a document that is not taken is not shown, but the popup still closes', async () => {
        h.setSelectedAppDocument.mockResolvedValue(false);
        await renderPopup();
        await submit();
        expect(h.setSelectedAppDocument).toHaveBeenCalledTimes(1);
        expect(h.showVaryAppDocument).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('a failed generation keeps the popup open and usable', async () => {
        h.generateBibleItemSlides.mockResolvedValue(null);
        await renderPopup();
        await submit();
        expect(h.getInstance).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(getButton('Generate Slides').disabled).toBe(false);
        expect(getButton('Cancel').disabled).toBe(false);
    });

    test('while generating, everything waits: no second run, no closing', async () => {
        const generation = genDeferred<unknown>();
        h.generateBibleItemSlides.mockReturnValue(generation.promise);
        await renderPopup();
        await submit();
        expect(query('.spinner-border')).not.toBeNull();
        expect(getButton('Cancel').disabled).toBe(true);
        expect(query<HTMLInputElement>('input[type="number"]')!.disabled).toBe(
            true,
        );
        expect(query<HTMLSelectElement>('select')!.disabled).toBe(true);
        expect(getBibleCheckbox('NIV').disabled).toBe(true);

        await submit();
        expect(h.generateBibleItemSlides).toHaveBeenCalledTimes(1);
        await act(async () =>
            query<HTMLButtonElement>('.widget-close')!.click(),
        );
        expect(onClose).not.toHaveBeenCalled();

        await act(async () => generation.resolve(null));
        expect(query('.spinner-border')).toBeNull();
        await act(async () =>
            query<HTMLButtonElement>('.widget-close')!.click(),
        );
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('Cancel closes it', async () => {
        await renderPopup();
        await act(async () => getButton('Cancel').click());
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(h.generateBibleItemSlides).not.toHaveBeenCalled();
    });
});
