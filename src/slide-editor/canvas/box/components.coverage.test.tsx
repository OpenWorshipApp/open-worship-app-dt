// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    controller: null as any,
    canvasItem: null as any,
    props: null as any,
    setEditing: null as any,
    setSelected: null as any,
    handleError: null as any,
    bibleValidate: null as any,
    youtubeValidate: null as any,
    fromTitleText: null as any,
    showBibleKeyOption: null as any,
    isDarkMode: false,
}));

vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
// `canvasHelpers` (the line height) needs only these two from the file layer
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => true,
    isSupportedMimetype: () => true,
}));
vi.mock('../../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../../../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.handleError(error),
}));
vi.mock('../../../others/themeHelpers', () => ({
    checkIsDarkMode: () => h.isDarkMode,
}));
vi.mock('../CanvasController', async () => {
    const { createContext } = await import('react');
    return {
        useCanvasControllerContext: () => h.controller,
        CanvasControllerContext: createContext(null),
    };
});
vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => h.canvasItem,
    useCanvasItemPropsContext: () => h.props,
    useSetEditingCanvasItem: () => h.setEditing,
    useSetSelectedCanvasItems: () => h.setSelected,
}));
vi.mock('../CanvasItemText', () => ({
    default: {
        genStyle: (props: { color: string; fontSize: number }) => ({
            color: props.color,
            fontSize: `${props.fontSize}px`,
            // overridden by the editor's own fixed textarea chrome
            background: 'red',
        }),
    },
}));
vi.mock('../CanvasItemBibleItem', () => ({
    default: {
        validate: (props: unknown) => h.bibleValidate(props),
        genStyle: () => ({ color: 'navy' }),
    },
}));
vi.mock('../CanvasItemYouTube', () => ({
    default: {
        validate: (props: unknown) => h.youtubeValidate(props),
        toEmbedUrl: (url: string) => `embed:${url}`,
    },
}));
vi.mock('../../../bible-list/BibleItem', () => ({
    default: {
        fromTitleText: (...args: unknown[]) => h.fromTitleText(...args),
    },
}));
vi.mock('../../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: (...args: unknown[]) => h.showBibleKeyOption(...args),
}));
vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    BoxEditorNormalViewErrorRenderComp: () => <i data-kind="error" />,
}));
vi.mock('./BoxEditorNormalViewImageModeComp', () => ({
    BoxEditorNormalImageRenderComp: () => <i data-kind="image" />,
}));
vi.mock('./BoxEditorNormalViewHtmlModeComp', () => ({
    BoxEditorNormalHtmlRenderComp: () => <i data-kind="html" />,
}));
vi.mock('./BoxEditorNormalViewTextModeComp', () => ({
    BoxEditorNormalTextRenderComp: () => <i data-kind="text" />,
}));
vi.mock('./BoxEditorNormalViewVideoModeComp', () => ({
    BoxEditorNormalVideoRenderComp: () => <i data-kind="video" />,
}));
vi.mock('./BoxEditorNormalViewAudioModeComp', () => ({
    BoxEditorNormalAudioRenderComp: () => <i data-kind="audio" />,
}));
vi.mock('./BoxEditorNormalViewWebsiteModeComp', () => ({
    BoxEditorNormalWebsiteRenderComp: () => <i data-kind="website" />,
}));
vi.mock('./BoxEditorNormalViewCameraModeComp', () => ({
    BoxEditorNormalCameraRenderComp: () => <i data-kind="camera" />,
}));

import { CanvasControllerContext } from '../CanvasController';
import BoxEditorNormalTextEditModeComp from './BoxEditorNormalTextEditModeComp';
import BoxEditorTextAreaComp from './BoxEditorTextAreaComp';
import BoxEditorCanvasItemRenderComp from './BoxEditorCanvasItemRenderComp';
import {
    genBoxEditorStyle,
    getRotatedResizeCursor,
    normalizeDegrees,
} from './boxEditorHelpers';
import {
    BoxEditorNormalBibleRenderComp,
    formatBibleKeys,
} from './BoxEditorNormalViewBibleModeComp';
import { BoxEditorNormalYouTubeRenderComp } from './BoxEditorNormalViewYouTubeModeComp';
import { SlideThumbnailContext } from './slideThumbnailContext';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let innerTextDescriptor: PropertyDescriptor | undefined;

function genTextProps(overrides: Record<string, unknown> = {}) {
    return {
        id: 4,
        type: 'text',
        text: 'Hello',
        color: '#ffffff',
        fontSize: 50,
        width: 400,
        height: 300,
        textHorizontalAlignment: 'left',
        textVerticalAlignment: 'center',
        ...overrides,
    };
}

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function getTextArea() {
    const textArea = container.querySelector('textarea');
    if (textArea === null) {
        throw new Error('no textarea');
    }
    return textArea;
}

async function typeInto(textArea: HTMLTextAreaElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(textArea, value);
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function dispatch(target: Element, event: Event) {
    await act(async () => {
        target.dispatchEvent(event);
    });
}

beforeEach(() => {
    h.controller = {
        editCanvasItemById: vi.fn(),
        addNewBibleItem: vi.fn(),
        replaceBibleItem: vi.fn(),
    };
    h.canvasItem = { id: 4, type: 'text' };
    h.props = genTextProps();
    h.setEditing = vi.fn();
    h.setSelected = vi.fn();
    h.handleError = vi.fn();
    h.bibleValidate = vi.fn();
    h.youtubeValidate = vi.fn();
    h.fromTitleText = vi.fn();
    h.showBibleKeyOption = vi.fn();
    h.isDarkMode = false;
    // jsdom has no layout, so no innerText; the Bible title is read from it
    innerTextDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'innerText',
    );
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get(this: HTMLElement) {
            return this.textContent ?? '';
        },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    if (innerTextDescriptor === undefined) {
        delete (HTMLElement.prototype as any).innerText;
    } else {
        Object.defineProperty(
            HTMLElement.prototype,
            'innerText',
            innerTextDescriptor,
        );
    }
});

describe('BoxEditorNormalTextEditModeComp', () => {
    it('commits a changed draft on Ctrl+Enter and selects the box', async () => {
        await render(<BoxEditorNormalTextEditModeComp />);
        const textArea = getTextArea();
        expect(textArea.value).toBe('Hello');
        expect(textArea.getAttribute('aria-label')).toBe('Text');
        await typeInto(textArea, 'Hello world');
        expect(getTextArea().value).toBe('Hello world');
        // a plain Enter is a new line, not a commit
        await dispatch(
            textArea,
            new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
        );
        expect(h.controller.editCanvasItemById).not.toHaveBeenCalled();
        await dispatch(
            textArea,
            new KeyboardEvent('keyup', {
                key: 'Enter',
                ctrlKey: true,
                bubbles: true,
            }),
        );
        expect(h.controller.editCanvasItemById).toHaveBeenCalledTimes(1);
        const [id, edit] = h.controller.editCanvasItemById.mock.calls[0];
        expect(id).toBe(4);
        const latest = { applyProps: vi.fn() };
        edit(latest);
        expect(latest.applyProps).toHaveBeenCalledWith({ text: 'Hello world' });
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
        expect(h.setEditing).not.toHaveBeenCalled();
    });

    it('selects without editing when the draft did not change', async () => {
        await render(<BoxEditorNormalTextEditModeComp />);
        await dispatch(
            getTextArea(),
            new FocusEvent('focusout', { bubbles: true }),
        );
        expect(h.controller.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.setSelected).toHaveBeenCalledTimes(1);
    });

    it('cancels on Escape without writing, and ignores the blur that follows', async () => {
        await render(<BoxEditorNormalTextEditModeComp />);
        const textArea = getTextArea();
        await typeInto(textArea, 'thrown away');
        await dispatch(
            textArea,
            new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
        );
        expect(h.setEditing).toHaveBeenCalledWith(h.canvasItem, false);
        await dispatch(textArea, new FocusEvent('focusout', { bubbles: true }));
        expect(h.controller.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.setSelected).not.toHaveBeenCalled();
        // the cancel flag is spent: a later blur commits again
        await dispatch(textArea, new FocusEvent('focusout', { bubbles: true }));
        expect(h.controller.editCanvasItemById).toHaveBeenCalledTimes(1);
        expect(h.setSelected).toHaveBeenCalledTimes(1);
    });

    it('commits on a right-click and keeps the box context menu closed', async () => {
        const parentContextMenu = vi.fn();
        await render(
            <div onContextMenu={parentContextMenu}>
                <BoxEditorNormalTextEditModeComp />
            </div>,
        );
        const textArea = getTextArea();
        await typeInto(textArea, 'right');
        await dispatch(
            textArea,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(parentContextMenu).not.toHaveBeenCalled();
        expect(h.controller.editCanvasItemById).toHaveBeenCalledTimes(1);
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
    });
});

describe('BoxEditorTextAreaComp', () => {
    async function renderTextArea(overrides: Record<string, unknown> = {}) {
        const onTextChange = vi.fn();
        const onBlur = vi.fn();
        const props = genTextProps(overrides) as any;
        await render(
            <BoxEditorTextAreaComp
                props={props}
                text={props.text}
                onTextChange={onTextChange}
                onBlur={onBlur}
            />,
        );
        return { onTextChange, onBlur, textArea: getTextArea() };
    }

    it('pads the text into its vertical alignment', async () => {
        // fontSize 50 -> base padding 5px, one line of 50 * 1.35 = 67.5px in
        // 300 - 2 * 5 = 290px leaves 222.5px to share out
        let { textArea } = await renderTextArea({
            textVerticalAlignment: 'center',
        });
        expect(textArea.style.paddingTop).toBe('116.25px');
        expect(textArea.style.paddingLeft).toBe('5px');
        expect(textArea.style.paddingBottom).toBe('5px');
        ({ textArea } = await renderTextArea({
            textVerticalAlignment: 'end',
            textHorizontalAlignment: 'right',
        }));
        expect(textArea.style.paddingTop).toBe('227.5px');
        expect(textArea.style.textAlign).toBe('right');
        ({ textArea } = await renderTextArea({
            textVerticalAlignment: 'start',
        }));
        expect(textArea.style.paddingTop).toBe('5px');
        // two lines and a box too short for them: no extra padding at all
        ({ textArea } = await renderTextArea({
            text: 'a\nb',
            height: 100,
            textVerticalAlignment: 'end',
        }));
        expect(textArea.style.paddingTop).toBe('5px');
    });

    it('keeps the item text style under the fixed editor chrome', async () => {
        const { textArea } = await renderTextArea({ color: 'rgb(1, 2, 3)' });
        expect(textArea.style.color).toBe('rgb(1, 2, 3)');
        expect(textArea.style.fontSize).toBe('50px');
        expect(textArea.style.background).toBe('transparent');
        expect(textArea.style.resize).toBe('none');
    });

    it('puts the caret at the end on focus and reports every change', async () => {
        const { textArea, onTextChange, onBlur } = await renderTextArea();
        textArea.setSelectionRange(0, 0);
        await dispatch(textArea, new FocusEvent('focusin', { bubbles: true }));
        expect(textArea.selectionStart).toBe(5);
        expect(textArea.selectionEnd).toBe(5);
        await typeInto(textArea, 'Hello!');
        expect(onTextChange).toHaveBeenCalledWith('Hello!');
        await dispatch(textArea, new FocusEvent('focusout', { bubbles: true }));
        expect(onBlur).toHaveBeenCalledTimes(1);
    });
});

describe('BoxEditorCanvasItemRenderComp', () => {
    it('draws each item type with its own renderer', async () => {
        for (const type of [
            'image',
            'video',
            'audio',
            'website',
            'camera',
            'text',
            'html',
        ]) {
            h.canvasItem = { id: 1, type };
            await render(<BoxEditorCanvasItemRenderComp />);
            expect(container.innerHTML).toBe(`<i data-kind="${type}"></i>`);
        }
        h.canvasItem = { id: 1, type: 'unknown' };
        await render(<BoxEditorCanvasItemRenderComp />);
        expect(container.innerHTML).toBe('<i data-kind="error"></i>');
    });

    it('routes youtube and bible items to their real views', async () => {
        h.canvasItem = { id: 2, type: 'youtube' };
        h.props = { id: 2, url: 'https://youtu.be/abc123' };
        await render(<BoxEditorCanvasItemRenderComp />);
        expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
            'embed:https://youtu.be/abc123',
        );
        h.canvasItem = { id: 3, type: 'bible' };
        h.props = { id: 3, html: '<p>Genesis 1:1</p>' };
        await render(<BoxEditorCanvasItemRenderComp />);
        expect(container.querySelector('div[title="3"]')?.innerHTML).toBe(
            '<p>Genesis 1:1</p>',
        );
    });
});

describe('boxEditorHelpers', () => {
    it('normalizes any angle into 0..359', () => {
        expect(normalizeDegrees(-90)).toBe(270);
        expect(normalizeDegrees(725)).toBe(5);
        expect(normalizeDegrees(360)).toBe(0);
    });

    it('turns a handle cursor with the box rotation', () => {
        expect(getRotatedResizeCursor('top-mid', 0)).toBe('n-resize');
        expect(getRotatedResizeCursor('right-mid', 90)).toBe('s-resize');
        expect(getRotatedResizeCursor('left-top', 30)).toBe('n-resize');
        expect(getRotatedResizeCursor('right-bottom', -100)).toBe('ne-resize');
        // an unknown handle counts as north
        expect(getRotatedResizeCursor('rotate', 100)).toBe('e-resize');
    });

    it('adds the hover pointer style only in the light theme', () => {
        const light = renderToStaticMarkup(genBoxEditorStyle());
        expect(light.match(/<style>/g)).toHaveLength(2);
        expect(light).toContain('.app-box-editor.editable');
        expect(light).toContain('animation-iteration-count: 3');
        expect(light).toContain('.shadow-caught-hover-pointer');
        h.isDarkMode = true;
        const dark = renderToStaticMarkup(genBoxEditorStyle());
        expect(dark.match(/<style>/g)).toHaveLength(2);
        expect(dark).not.toContain('.shadow-caught-hover-pointer');
    });
});

describe('formatBibleKeys', () => {
    function genBox(innerHtml: string, boxId = '5') {
        const box = document.createElement('div');
        box.setAttribute('data-app-box-editor-id', boxId);
        box.innerHTML = innerHtml;
        return box;
    }

    it('makes a Bible key pickable and replaces the item with the chosen Bible', async () => {
        const box = genBox(
            '<p>John 3:16 <span data-bible-key=" KJV ">(KJV)</span></p>',
        );
        formatBibleKeys(box, h.controller);
        const key = box.querySelector<HTMLElement>('[data-bible-key]')!;
        expect(key.classList.contains('app-caught-hover-pointer')).toBe(true);
        expect(key.title).toBe(
            'KJV, chose with Ctrl+Click to add a new Bible item',
        );
        const outerClick = vi.fn();
        box.addEventListener('click', outerClick);
        key.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(outerClick).not.toHaveBeenCalled();
        expect(h.showBibleKeyOption).toHaveBeenCalledTimes(1);
        const [, onSelect, keys] = h.showBibleKeyOption.mock.calls[0];
        expect(keys).toEqual(['KJV']);

        const bibleItem = { bibleKey: 'KJV' };
        h.fromTitleText.mockImplementation(async () => bibleItem);
        await onSelect('NIV', { ctrlKey: false });
        expect(h.fromTitleText).toHaveBeenCalledWith('KJV', 'John 3:16');
        expect(bibleItem.bibleKey).toBe('NIV');
        expect(h.controller.replaceBibleItem).toHaveBeenCalledWith(
            5,
            bibleItem,
        );
        expect(h.controller.addNewBibleItem).not.toHaveBeenCalled();

        await onSelect('ESV', { ctrlKey: true });
        expect(h.controller.addNewBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(bibleItem.bibleKey).toBe('ESV');
        expect(h.controller.replaceBibleItem).toHaveBeenCalledTimes(1);

        h.fromTitleText.mockImplementation(async () => null);
        await onSelect('ASV', { ctrlKey: true });
        expect(h.controller.addNewBibleItem).toHaveBeenCalledTimes(1);
        expect(h.controller.replaceBibleItem).toHaveBeenCalledTimes(1);
    });

    it('leaves alone a key that is blank, outside a box, under a bad id or without a title', () => {
        const blank = genBox(
            '<p>John 1:1 <span data-bible-key="  ">x</span></p>',
        );
        const loose = document.createElement('div');
        loose.innerHTML =
            '<p>John 1:2 <span data-bible-key="KJV">(KJV)</span></p>';
        const badId = genBox(
            '<p>John 1:3 <span data-bible-key="KJV">(KJV)</span></p>',
            'abc',
        );
        const noTitle = genBox(
            '<p><span data-bible-key="KJV">(KJV)</span></p>',
        );
        const svg = genBox(
            '<p>John 1:4 <svg><g data-bible-key="KJV"></g></svg></p>',
        );
        for (const element of [blank, loose, badId, noTitle, svg]) {
            formatBibleKeys(element, h.controller);
            const key = element.querySelector('[data-bible-key]')!;
            expect(key.classList.contains('app-caught-hover-pointer')).toBe(
                false,
            );
            expect(key.getAttribute('title')).toBe(null);
        }
    });
});

describe('BoxEditorNormalBibleRenderComp', () => {
    it('formats the keys only when a canvas controller is provided', async () => {
        h.props = {
            id: 8,
            html: '<p>Psalm 23:1 <span data-bible-key="KJV">(KJV)</span></p>',
        };
        await render(
            <div data-app-box-editor-id="8">
                <BoxEditorNormalBibleRenderComp />
            </div>,
        );
        expect(container.querySelector('div[title="8"]')).not.toBe(null);
        expect(
            container.querySelector('[data-bible-key]')?.getAttribute('title'),
        ).toBe(null);
        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        await render(
            <CanvasControllerContext value={h.controller}>
                <div data-app-box-editor-id="8">
                    <BoxEditorNormalBibleRenderComp />
                </div>
            </CanvasControllerContext>,
        );
        expect(
            container.querySelector('[data-bible-key]')?.getAttribute('title'),
        ).toBe('KJV, chose with Ctrl+Click to add a new Bible item');
        const bibleDiv =
            container.querySelector<HTMLElement>('div[title="8"]')!;
        expect(bibleDiv.style.color).toBe('navy');
        expect(bibleDiv.style.width).toBe('100%');
    });

    it('shows the error view when the item does not validate', async () => {
        h.props = { id: 8, html: '' };
        const error = new Error('bad bible item');
        h.bibleValidate.mockImplementation(() => {
            throw error;
        });
        await render(<BoxEditorNormalBibleRenderComp />);
        expect(container.innerHTML).toBe('<i data-kind="error"></i>');
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('BoxEditorNormalYouTubeRenderComp', () => {
    it('plays the embed on the canvas, never pointer-reachable', async () => {
        h.props = { id: 6, url: 'https://www.youtube.com/watch?v=xyz' };
        await render(<BoxEditorNormalYouTubeRenderComp />);
        const iframe = container.querySelector('iframe')!;
        expect(iframe.getAttribute('src')).toBe(
            'embed:https://www.youtube.com/watch?v=xyz',
        );
        expect(iframe.title).toBe('youtube-6');
        expect(
            container.querySelector<HTMLElement>('div[title="6"]')!.style
                .pointerEvents,
        ).toBe('none');
        expect(h.youtubeValidate).toHaveBeenCalledWith(h.props);
    });

    it('draws a still in a thumbnail and falls back to the address when it fails', async () => {
        h.props = { id: 6, url: 'https://youtu.be/abc123' };
        await render(
            <SlideThumbnailContext value>
                <BoxEditorNormalYouTubeRenderComp />
            </SlideThumbnailContext>,
        );
        expect(container.querySelector('iframe')).toBe(null);
        const image = container.querySelector('img')!;
        expect(image.getAttribute('src')).toBe(
            'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
        );
        expect(container.querySelector('.app-ellipsis')).toBe(null);
        await dispatch(image, new Event('error'));
        expect(container.querySelector('img')).toBe(null);
        expect(container.querySelector('.app-ellipsis')?.textContent).toBe(
            'https://youtu.be/abc123',
        );
        expect(container.querySelector('svg')).not.toBe(null);
    });

    it('shows only the address in a thumbnail for a link that is not YouTube', async () => {
        h.props = { id: 6, url: 'https://example.com/video' };
        await render(
            <SlideThumbnailContext value>
                <BoxEditorNormalYouTubeRenderComp />
            </SlideThumbnailContext>,
        );
        expect(container.querySelector('img')).toBe(null);
        expect(container.querySelector('.app-ellipsis')?.textContent).toBe(
            'https://example.com/video',
        );
    });

    it('shows the error view for an invalid item', async () => {
        h.props = { id: 6, url: '' };
        const error = new Error('Invalid canvas item url data');
        h.youtubeValidate.mockImplementation(() => {
            throw error;
        });
        await render(<BoxEditorNormalYouTubeRenderComp />);
        expect(container.innerHTML).toBe('<i data-kind="error"></i>');
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});
