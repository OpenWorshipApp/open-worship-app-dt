// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    fromTitleText: vi.fn(),
    showBibleKeyOption: vi.fn(),
    validate: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../../bible-list/BibleItem', () => ({
    default: { fromTitleText: h.fromTitleText },
}));

vi.mock('../../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOption,
}));

vi.mock('../CanvasItemBibleItem', () => ({
    default: {
        validate: h.validate,
        genStyle: () => ({ color: 'navy' }),
    },
}));

vi.mock('../../../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsContext: () => h.props,
}));

vi.mock('../CanvasController', async () => {
    const react = await import('react');
    return { CanvasControllerContext: react.createContext(null) };
});

vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    BoxEditorNormalViewErrorRenderComp: () => <div>Error</div>,
}));

import {
    BoxEditorNormalBibleRenderComp,
    formatBibleKeys,
} from './BoxEditorNormalViewBibleModeComp';
import { CanvasControllerContext } from '../CanvasController';

let container: HTMLDivElement;
let root: Root;
let controller: {
    addNewBibleItem: ReturnType<typeof vi.fn>;
    replaceBibleItem: ReturnType<typeof vi.fn>;
};

// jsdom has no `innerText`; the title is read from it, so give every element
// the plain-text reading a browser would for these flat fixtures.
function polyfillInnerText() {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get(this: HTMLElement) {
            return this.textContent ?? '';
        },
    });
}

function mountBox(innerHtml: string, boxId = '7') {
    const box = document.createElement('div');
    box.setAttribute('data-app-box-editor-id', boxId);
    box.innerHTML = innerHtml;
    container.appendChild(box);
    return box;
}

// Runs the option callback `showBibleKeyOption` was handed, as if the operator
// picked `newBibleKey` from it.
async function chooseBibleKey(newBibleKey: string, ctrlKey: boolean) {
    const [, onSelect, currentKeys] = h.showBibleKeyOption.mock.calls.at(-1)!;
    await onSelect(newBibleKey, { ctrlKey });
    return currentKeys;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    polyfillInnerText();
    h.fromTitleText.mockReset();
    h.showBibleKeyOption.mockReset();
    h.validate.mockReset();
    h.handleError.mockReset();
    controller = { addNewBibleItem: vi.fn(), replaceBibleItem: vi.fn() };
    h.props = {
        id: 7,
        html: '',
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete (HTMLElement.prototype as any).innerText;
    vi.unstubAllGlobals();
});

describe('formatBibleKeys', () => {
    test('turns a Bible key into a button that swaps the verse to another Bible', async () => {
        const box = mountBox(
            '<div>Genesis 1:1 <span data-bible-key=" KJV ">(KJV)</span></div>',
        );
        const keyElement = box.querySelector<HTMLElement>('[data-bible-key]')!;
        const boxClick = vi.fn();
        box.addEventListener('click', boxClick);

        formatBibleKeys(box, controller as any);

        expect(keyElement.classList.contains('app-caught-hover-pointer')).toBe(
            true,
        );
        expect(keyElement.title).toBe(
            'KJV, chose with Ctrl+Click to add a new Bible item',
        );

        keyElement.click();
        // The box underneath must not take the click as a selection.
        expect(boxClick).not.toHaveBeenCalled();
        expect(h.showBibleKeyOption).toHaveBeenCalledOnce();

        const bibleItem = { bibleKey: 'KJV' };
        h.fromTitleText.mockResolvedValue(bibleItem);
        expect(await chooseBibleKey('NIV', false)).toEqual(['KJV']);

        expect(h.fromTitleText).toHaveBeenCalledWith('KJV', 'Genesis 1:1');
        expect(bibleItem.bibleKey).toBe('NIV');
        expect(controller.replaceBibleItem).toHaveBeenCalledWith(7, bibleItem);
        expect(controller.addNewBibleItem).not.toHaveBeenCalled();
    });

    test('Ctrl+choosing a Bible adds the verse as a new item instead', async () => {
        const box = mountBox(
            '<p>John 3:16 <b data-bible-key="ESV">(ESV)</b></p>',
            '12',
        );
        formatBibleKeys(box, controller as any);
        box.querySelector<HTMLElement>('[data-bible-key]')!.click();

        const bibleItem = { bibleKey: 'ESV' };
        h.fromTitleText.mockResolvedValue(bibleItem);
        await chooseBibleKey('KJV', true);

        expect(h.fromTitleText).toHaveBeenCalledWith('ESV', 'John 3:16');
        expect(bibleItem.bibleKey).toBe('KJV');
        expect(controller.addNewBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(controller.replaceBibleItem).not.toHaveBeenCalled();
    });

    test('a title that no longer parses changes nothing', async () => {
        const box = mountBox(
            '<div>Nowhere 99:99 <span data-bible-key="KJV">(KJV)</span></div>',
        );
        formatBibleKeys(box, controller as any);
        box.querySelector<HTMLElement>('[data-bible-key]')!.click();

        h.fromTitleText.mockResolvedValue(null);
        await chooseBibleKey('NIV', true);
        await chooseBibleKey('NIV', false);

        expect(controller.addNewBibleItem).not.toHaveBeenCalled();
        expect(controller.replaceBibleItem).not.toHaveBeenCalled();
    });

    test.each([
        [
            'a blank key',
            '<div>Genesis 1:1 <span data-bible-key="  ">(KJV)</span></div>',
            '7',
        ],
        [
            'a key with nothing but itself to read',
            '<div><span data-bible-key="KJV">(KJV)</span></div>',
            '7',
        ],
        [
            'a box whose id is not a number',
            '<div>Genesis 1:1 <span data-bible-key="KJV">(KJV)</span></div>',
            'not-a-number',
        ],
        [
            'a box with an empty id',
            '<div>Genesis 1:1 <span data-bible-key="KJV">(KJV)</span></div>',
            '',
        ],
    ])('leaves %s alone', (_label, innerHtml, boxId) => {
        const box = mountBox(innerHtml, boxId);
        formatBibleKeys(box, controller as any);

        const keyElement = box.querySelector<HTMLElement>('[data-bible-key]')!;
        expect(keyElement.classList.contains('app-caught-hover-pointer')).toBe(
            false,
        );
        expect(keyElement.onclick).toBeNull();
    });

    test('ignores keys outside any box and on non-HTML elements', () => {
        const loose = document.createElement('div');
        loose.innerHTML =
            '<div>Genesis 1:1 <span data-bible-key="KJV">(KJV)</span></div>';
        container.appendChild(loose);
        const box = mountBox(
            '<div>Genesis 1:1 <svg data-bible-key="KJV"></svg></div>',
        );

        formatBibleKeys(loose, controller as any);
        formatBibleKeys(box, controller as any);

        expect(
            loose.querySelector<HTMLElement>('[data-bible-key]')!.onclick,
        ).toBeNull();
        expect(
            box
                .querySelector('[data-bible-key]')!
                .classList.contains('app-caught-hover-pointer'),
        ).toBe(false);
    });
});

describe('BoxEditorNormalBibleRenderComp', () => {
    test('wires the Bible keys of the rendered verses inside the editor', async () => {
        h.props = {
            id: 9,
            html: '<div>Psalm 23:1 <span data-bible-key="KJV">(KJV)</span></div>',
        };
        await act(async () => {
            root.render(
                <div data-app-box-editor-id="9">
                    <CanvasControllerContext value={controller as any}>
                        <BoxEditorNormalBibleRenderComp />
                    </CanvasControllerContext>
                </div>,
            );
        });

        const rendered = container.querySelector<HTMLElement>('[title="9"]');
        expect(rendered?.style.color).toBe('navy');
        const keyElement =
            container.querySelector<HTMLElement>('[data-bible-key]')!;
        expect(keyElement.title).toBe(
            'KJV, chose with Ctrl+Click to add a new Bible item',
        );

        keyElement.click();
        h.fromTitleText.mockResolvedValue({ bibleKey: 'KJV' });
        await chooseBibleKey('NIV', false);
        expect(h.fromTitleText).toHaveBeenCalledWith('KJV', 'Psalm 23:1');
        expect(controller.replaceBibleItem).toHaveBeenCalledWith(9, {
            bibleKey: 'NIV',
        });
    });

    test('outside the editor the Bible keys stay plain text', async () => {
        h.props = {
            id: 9,
            html: '<div>Psalm 23:1 <span data-bible-key="KJV">(KJV)</span></div>',
        };
        await act(async () => {
            root.render(
                <div data-app-box-editor-id="9">
                    <BoxEditorNormalBibleRenderComp />
                </div>,
            );
        });

        const keyElement =
            container.querySelector<HTMLElement>('[data-bible-key]')!;
        expect(keyElement.onclick).toBeNull();
        expect(keyElement.title).toBe('');
    });
});
