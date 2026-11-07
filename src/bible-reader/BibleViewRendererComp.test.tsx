// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        resizeActorProps: [] as {
            flexSizeDefault: { [key: string]: string[] };
            dataInputKeys: string[];
            isHorizontal?: boolean;
            flexSizeName?: string;
        }[],
        viewController: {
            toSettingName: (name: string) => `setting-${name}`,
            finalRenderer: (bibleItem: any) => {
                return <div data-testid={`item-${bibleItem.id}`} />;
            },
        },
    };
});

vi.mock('./BibleItemsViewController', () => ({
    RESIZE_SETTING_NAME: 'bible-previewer-render',
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: ({
        flexSizeDefault,
        dataInput,
        isHorizontal,
        flexSizeName,
    }: any) => {
        h.resizeActorProps.push({
            flexSizeDefault,
            dataInputKeys: dataInput.map(({ key }: any) => key),
            isHorizontal,
            flexSizeName,
        });
        return (
            <div>
                {dataInput.map(({ key, children }: any) => (
                    <div key={key}>{children.render()}</div>
                ))}
            </div>
        );
    },
}));
vi.mock('./NoBibleViewAvailableComp', () => ({
    default: () => <div data-testid="no-bible-view" />,
}));
vi.mock('../others/themeHelpers', () => ({
    checkIsDarkMode: () => true,
    useThemeSource: () => ({ themeSource: 'dark' }),
}));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (label: string) => ({ widgetName: label }),
}));

import BibleViewRendererComp from './BibleViewRendererComp';
import { BibleViewPaneHostContext } from './bibleViewPaneHelpers';

function genItem(id: number) {
    return { id } as any;
}

describe('BibleViewRendererComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        h.resizeActorProps.length = 0;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        vi.clearAllMocks();
    });

    test('every pane key has a default size', () => {
        act(() => {
            root.render(
                <BibleViewRendererComp
                    nestedBibleItems={[genItem(1), genItem(2)]}
                />,
            );
        });
        const [{ flexSizeDefault, dataInputKeys }] = h.resizeActorProps;
        expect(dataInputKeys).toEqual(['i1', 'i2']);
        expect(Object.keys(flexSizeDefault)).toEqual(dataInputKeys);
    });

    // Keyed by the first view's id alone, splitting a group's first view
    // renamed the group, rebuilt its resize container and reset its sizes.
    test('splitting the first view of a group keeps the group key', () => {
        act(() => {
            root.render(
                <BibleViewRendererComp
                    nestedBibleItems={[genItem(1), [genItem(2), genItem(3)]]}
                />,
            );
        });
        expect(h.resizeActorProps[0].dataInputKeys).toEqual(['i1', 'g2']);
        h.resizeActorProps.length = 0;
        act(() => {
            root.render(
                <BibleViewRendererComp
                    nestedBibleItems={[
                        genItem(1),
                        [[genItem(4), genItem(2)], genItem(3)],
                    ]}
                />,
            );
        });
        expect(h.resizeActorProps[0].dataInputKeys).toEqual(['i1', 'g2']);
        expect(h.resizeActorProps[1].dataInputKeys).toEqual(['i2', 'i3']);
    });

    // The view controller mutates its nested arrays IN PLACE
    // (`addBibleItem` -> `parentNestedBibleItems.splice`) and only afterwards
    // fires its update event, so a render landing in that window sees the SAME
    // array reference with a new length. Memoizing the default sizes on that
    // reference left them one pane behind `dataInput`, and `ResizeActorComp`
    // threw `key v3 not found in flexSizeDefault:{"v1":["1"],"v2":["1"]}`.
    test('default sizes follow an in-place split of the same array', () => {
        const verticalItems = [genItem(2), genItem(3)];
        const nestedBibleItems = [genItem(1), verticalItems];
        act(() => {
            root.render(
                <BibleViewRendererComp nestedBibleItems={nestedBibleItems} />,
            );
        });
        expect(h.resizeActorProps[0].dataInputKeys).toEqual(['i1', 'g2']);
        expect(h.resizeActorProps[1].dataInputKeys).toEqual(['i2', 'i3']);
        verticalItems.splice(2, 0, genItem(4));
        h.resizeActorProps.length = 0;
        act(() => {
            root.render(
                <BibleViewRendererComp nestedBibleItems={nestedBibleItems} />,
            );
        });
        const vertical = h.resizeActorProps[1];
        expect(vertical.dataInputKeys).toEqual(['i2', 'i3', 'i4']);
        expect(Object.keys(vertical.flexSizeDefault)).toEqual(
            vertical.dataInputKeys,
        );
    });

    test('a split holding one split draws that one alone, turned the other way', () => {
        act(() => {
            root.render(
                <BibleViewRendererComp
                    nestedBibleItems={[[genItem(1), genItem(2)]]}
                />,
            );
        });
        // No resize container for the lone child: only the split it holds,
        // laid out across rather than along.
        expect(h.resizeActorProps).toEqual([
            {
                flexSizeDefault: { i1: ['1'], i2: ['1'] },
                dataInputKeys: ['i1', 'i2'],
                isHorizontal: false,
                flexSizeName: 'setting-bible-previewer-render-hv',
            },
        ]);
        expect(
            Array.from(container.querySelectorAll('[data-testid]')).map(
                (element) => element.getAttribute('data-testid'),
            ),
        ).toEqual(['item-1', 'item-2']);
    });

    test('no view at all offers the empty view', () => {
        act(() => {
            root.render(<BibleViewRendererComp nestedBibleItems={[]} />);
        });
        expect(container.innerHTML).toBe(
            '<div data-testid="no-bible-view"></div>',
        );
        expect(h.resizeActorProps).toEqual([]);
    });

    test('inside a pane host each view is only given a slot to be moved into', () => {
        const detach = vi.fn();
        const paneHost = { attach: vi.fn(() => detach) };
        act(() => {
            root.render(
                <BibleViewPaneHostContext value={paneHost as any}>
                    <BibleViewRendererComp
                        nestedBibleItems={[genItem(1), genItem(2)]}
                    />
                </BibleViewPaneHostContext>,
            );
        });
        const slotList = Array.from(
            container.querySelectorAll<HTMLElement>('.bible-view-pane-slot'),
        );
        expect(slotList).toHaveLength(2);
        expect(slotList[0].style.display).toBe('contents');
        // The host draws the views; the layout draws none.
        expect(container.querySelector('[data-testid^="item-"]')).toBeNull();
        expect(paneHost.attach.mock.calls).toEqual([
            [1, slotList[0]],
            [2, slotList[1]],
        ]);
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(detach).toHaveBeenCalledTimes(2);
    });
});
