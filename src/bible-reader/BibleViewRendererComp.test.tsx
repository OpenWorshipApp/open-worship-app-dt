// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        resizeActorProps: [] as {
            flexSizeDefault: { [key: string]: string[] };
            dataInputKeys: string[];
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
    default: ({ flexSizeDefault, dataInput }: any) => {
        h.resizeActorProps.push({
            flexSizeDefault,
            dataInputKeys: dataInput.map(({ key }: any) => key),
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
        expect(dataInputKeys).toEqual(['h1', 'h2']);
        expect(Object.keys(flexSizeDefault)).toEqual(dataInputKeys);
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
        expect(h.resizeActorProps[1].dataInputKeys).toEqual(['v1', 'v2']);
        verticalItems.splice(2, 0, genItem(4));
        h.resizeActorProps.length = 0;
        act(() => {
            root.render(
                <BibleViewRendererComp nestedBibleItems={nestedBibleItems} />,
            );
        });
        const vertical = h.resizeActorProps[1];
        expect(vertical.dataInputKeys).toEqual(['v1', 'v2', 'v3']);
        expect(Object.keys(vertical.flexSizeDefault)).toEqual(
            vertical.dataInputKeys,
        );
    });
});
