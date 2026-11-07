// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        handleDragStart: vi.fn(),
        editorProps: null as any,
    };
});

vi.mock('../../helper/bibleViewHelpers', () => ({
    useBibleViewFontSizeContext: () => 24,
}));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
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
vi.mock('../../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `Font ${bibleKey}`,
}));
vi.mock('../BibleViewTitleEditorComp', () => ({
    default: (props: any) => {
        h.editorProps = props;
        return <span className="title-editor" />;
    },
}));

import { DragTypeEnum } from '../../helper/DragInf';
import { BibleDirectViewTitleComp } from './BibleDirectViewTitleComp';
import { BibleViewTitleEditingComp } from './BibleViewTitleEditingComp';
import BibleViewTitleWrapperComp from './BibleViewTitleWrapperComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    id: 3,
    bibleKey: 'XXB',
    target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 17 },
    toTitle: async () => '✝♡ 3:16-17',
} as any;

let host: HTMLDivElement;
let root: Root;

async function renderNode(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    await act(async () => {
        await Promise.resolve();
    });
}

function getTitle() {
    return host.querySelector<HTMLElement>('span.title')!;
}

function fireDrag(type: 'dragstart' | 'dragend') {
    act(() => {
        getTitle().dispatchEvent(new Event(type, { bubbles: true }));
    });
}

beforeEach(() => {
    h.editorProps = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('BibleViewTitleWrapperComp', () => {
    test("sets the title in the view's size and the bible's own face", async () => {
        await renderNode(
            <BibleViewTitleWrapperComp bibleKey="XXB">
                <b>John 3:16</b>
            </BibleViewTitleWrapperComp>,
        );
        const title = getTitle();
        expect(title.className).toBe('title full-view-reset-font-size');
        expect(title.style.fontSize).toBe('24px');
        expect(title.style.fontFamily).toBe('Font XXB');
        expect(title.style.paddingLeft).toBe('5px');
        expect(title.innerHTML).toBe('<b>John 3:16</b>');
        // Nothing to carry, so nothing to drag.
        expect(title.getAttribute('draggable')).toBe('false');
        fireDrag('dragstart');
        expect(h.handleDragStart).not.toHaveBeenCalled();
    });

    test("dragging a view's title carries its passage, and the view refuses its own drop meanwhile", async () => {
        await renderNode(
            <div className="bible-view">
                <div>
                    <BibleViewTitleWrapperComp
                        bibleKey="XXB"
                        bibleItem={bibleItem}
                    >
                        John 3:16
                    </BibleViewTitleWrapperComp>
                </div>
            </div>,
        );
        const view = host.querySelector('.bible-view')!;
        expect(getTitle().getAttribute('draggable')).toBe('true');

        fireDrag('dragstart');
        expect(view.getAttribute('data-do-not-allow-drop')).toBe('1');
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        const [event, item, type] = h.handleDragStart.mock.calls[0];
        expect(event.type).toBe('dragstart');
        expect(item).toBe(bibleItem);
        expect(type).toBe(DragTypeEnum.BIBLE_ITEM_TARGET_ONLY);

        fireDrag('dragend');
        expect(view.getAttribute('data-do-not-allow-drop')).toBe('0');
    });

    test('a title outside any bible view still drags, marking nothing', async () => {
        await renderNode(
            <BibleViewTitleWrapperComp bibleKey="XXB" bibleItem={bibleItem}>
                John 3:16
            </BibleViewTitleWrapperComp>,
        );
        fireDrag('dragstart');
        fireDrag('dragend');
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-do-not-allow-drop]')).toBeNull();
    });
});

describe('BibleViewTitleEditingComp', () => {
    test('an editable, draggable title, with whatever follows it', async () => {
        const onTargetChange = vi.fn();
        await renderNode(
            <BibleViewTitleEditingComp
                bibleItem={bibleItem}
                onTargetChange={onTargetChange}
            >
                <i className="after-title" />
            </BibleViewTitleEditingComp>,
        );
        const title = getTitle();
        expect(title.getAttribute('draggable')).toBe('true');
        expect(title.style.fontFamily).toBe('Font XXB');
        expect(
            Array.from(title.childNodes).map((node) => {
                return node.nodeType === Node.TEXT_NODE
                    ? node.textContent
                    : (node as Element).className;
            }),
        ).toEqual(['title-editor', ' ', 'after-title']);
        expect(h.editorProps.bibleItem).toBe(bibleItem);
        expect(h.editorProps.onTargetChange).toBe(onTargetChange);
    });
});

describe('BibleDirectViewTitleComp', () => {
    test("shows the passage's title in the bible's own face", async () => {
        await renderNode(<BibleDirectViewTitleComp bibleItem={bibleItem} />);
        const title = host.querySelector<HTMLElement>('span.title')!;
        expect(title.textContent).toBe('✝♡ 3:16-17');
        expect(title.style.fontFamily).toBe('Font XXB');
        expect(title.className).toContain('app-found-highlight');
    });
});
