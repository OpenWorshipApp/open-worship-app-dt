// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    slide: null as any,
    slides: [] as any[],
    fileCallbacks: [] as Array<() => void>,
    getSlides: vi.fn(),
    getSlideIndex: vi.fn(),
    changeDimensions: vi.fn(),
    updateSlide: vi.fn(),
    confirm: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../../app-document-list/AppDocument', () => ({
    default: {
        getInstance: () => ({
            getSlides: h.getSlides,
            getSlideIndex: h.getSlideIndex,
            changeSlidesDimension: h.changeDimensions,
            updateSlide: h.updateSlide,
        }),
    },
}));
vi.mock('../../../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: (filePath: string, id: string) => `${filePath}:${id}`,
    useSelectedEditingSlideContext: () => h.slide,
}));
vi.mock('../../../app-document-presenter/items/RenderSlideIndexComp', () => ({
    default: ({ viewIndex, dataKey }: { viewIndex: number; dataKey: string }) =>
        createElement('span', { 'data-key': dataKey }, `Index ${viewIndex}`),
}));
vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../../../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: () => ({ bounds: { width: 1280, height: 720 } }),
}));
vi.mock('../../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.confirm,
}));
vi.mock('../../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: unknown, callback: () => void) => {
        h.fileCallbacks.push(callback);
    },
}));
vi.mock('../../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('./useExpandToggle', async () => {
    const react = await import('react');
    return {
        useExpandToggle: (initial: boolean) => {
            const [isExpanded, setExpanded] = react.useState(initial);
            return {
                isExpanded,
                headerProps: { onClick: () => setExpanded((value) => !value) },
            };
        },
        ExpandChevronComp: ({ isExpanded }: { isExpanded: boolean }) =>
            createElement('span', {}, isExpanded ? 'Expanded' : 'Collapsed'),
    };
});

import SlidePropertyEditorComp from './SlidePropertyEditorComp';

let root: Root;
let container: HTMLDivElement;

async function renderEditor() {
    await act(async () => root.render(createElement(SlidePropertyEditorComp)));
}

async function expand() {
    await act(async () =>
        container.querySelector<HTMLElement>('.spe-header')!.click(),
    );
}

function input(label: string) {
    return container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    )!;
}

async function typeValue(element: HTMLInputElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function button(label: string) {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => candidate.textContent === label)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.fileCallbacks = [];
    h.slide = {
        id: 'slide-1',
        filePath: 'C:/documents/service.owa',
        name: 'Opening',
        metadata: { width: 800, height: 600 },
        checkIsSame(other: any) {
            return other === this;
        },
    };
    h.slides = [
        h.slide,
        {
            id: 'other',
            metadata: { width: 1024, height: 768 },
            checkIsSame: () => false,
        },
    ];
    h.getSlides.mockImplementation(async () => h.slides);
    h.getSlideIndex.mockResolvedValue(2);
    h.changeDimensions.mockResolvedValue(undefined);
    h.confirm.mockResolvedValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('slide property editor', () => {
    it('starts collapsed and shows the current slide number and ID', async () => {
        await renderEditor();
        expect(container.textContent).toContain('Slide');
        expect(container.textContent).toContain('Index 3');
        expect(container.textContent).toContain('ID slide-1');
        expect(
            container.querySelector('[data-key]')?.getAttribute('data-key'),
        ).toBe(`${h.slide.filePath}:slide-1`);
        expect(container.querySelector('input[aria-label="Width"]')).toBeNull();
        expect(container.textContent).toContain('Collapsed');
    });

    it('applies a changed name once and clears the pending action', async () => {
        await renderEditor();
        await expand();
        const name =
            container.querySelector<HTMLInputElement>('input[type="text"]')!;
        await typeValue(name, 'Welcome');
        expect(button('Apply')).toBeDefined();
        await act(async () => button('Apply').click());
        expect(h.slide.name).toBe('Welcome');
        expect(h.updateSlide).toHaveBeenCalledWith(h.slide);
        expect(button('Apply')).toBeUndefined();
    });

    it('applies edited dimensions to only the selected slide', async () => {
        await renderEditor();
        await expand();
        await typeValue(input('Width'), '1000');
        await typeValue(input('Height'), '700');
        expect(input('Width').value).toBe('1000');
        await act(async () => button('Apply').click());
        expect(h.changeDimensions).toHaveBeenCalledWith(
            { width: 1000, height: 700 },
            h.slide,
        );
    });

    it('requires confirmation before applying dimensions to all slides', async () => {
        await renderEditor();
        await expand();
        expect(button('Apply All Slides')).toBeDefined();
        h.confirm.mockResolvedValueOnce(false);
        await act(async () => button('Apply All Slides').click());
        expect(h.changeDimensions).not.toHaveBeenCalled();
        await act(async () => button('Apply All Slides').click());
        expect(h.confirm).toHaveBeenCalledWith(
            'This will change all Slides',
            'Are you sure to apply this dimension to all slides?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(h.changeDimensions).toHaveBeenCalledWith(
            { width: 800, height: 600 },
            undefined,
        );
    });

    it('resets the selected slide to the default display dimensions', async () => {
        await renderEditor();
        await expand();
        await act(async () => button('Reset').click());
        expect(h.changeDimensions).toHaveBeenCalledWith(
            { width: 1280, height: 720 },
            h.slide,
        );
    });

    it('refreshes the slide index after a document update', async () => {
        await renderEditor();
        h.getSlideIndex.mockResolvedValue(4);
        await act(async () => h.fileCallbacks.at(-1)!());
        expect(container.textContent).toContain('Index 5');
    });
});
