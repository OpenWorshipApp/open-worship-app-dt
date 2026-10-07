// @vitest-environment jsdom

import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: any) => children,
}));
vi.mock('./FlexResizeActorComp', () => ({
    default: () => null,
    ACTIVE_HIDDEN_WIDGET_CLASS: 'active-hidden-widget',
}));
vi.mock('./RenderHiddenWidgetTitleComp', () => ({
    default: () => null,
}));
vi.mock('./dynamicFlexSizeHelpers', () => ({
    checkCanClose: vi.fn(),
    reopenAnotherHiddenWidget: vi.fn(),
}));
vi.mock('../helper/mediaControlHelpers', () => ({
    checkMediaPlaying: () => false,
}));
vi.mock('./flexSizeHelpers', () => ({
    keyToDataFlexSizeKey: (flexSizeName: string, key: string) => {
        return `${flexSizeName}-${key}`;
    },
    setDisablingSetting: vi.fn(),
    genFlexSizeSetting: vi.fn(),
    checkIsThereNotHiddenWidget: () => false,
    calcShowingHiddenWidget: vi.fn(),
}));

import RenderResizeActorItemComp from './RenderResizeActorItemComp';
import { WidgetMenuExcludedContext } from './widgetMenuContext';
import { getWidgetEntries } from './widgetRegistry';
import type { DataInputType, FlexSizeType } from './flexSizeHelpers';

const flexSize: FlexSizeType = { v1: ['6'], v2: ['1'] };
const dataInput: DataInputType[] = [
    { children: { render: () => null }, key: 'v1', widgetName: 'Slides' },
    { children: { render: () => null }, key: 'v2', widgetName: 'Note' },
];

function PanesComp() {
    return (
        <>
            {dataInput.map((data, index) => {
                return (
                    <RenderResizeActorItemComp
                        key={data.key}
                        data={data}
                        index={index}
                        flexSize={flexSize}
                        setFlexSize={() => {}}
                        restoreFlexSize={flexSize}
                        defaultFlexSize={flexSize}
                        flexSizeName="previewer"
                        dataInput={dataInput}
                        isDisableQuickResize={false}
                        isHorizontal={false}
                        isOnScreen={false}
                    />
                );
            })}
        </>
    );
}

describe('RenderResizeActorItemComp View → Widgets registration', () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('a page pane is listed in the menu', () => {
        act(() => {
            root.render(<PanesComp />);
        });
        expect(
            getWidgetEntries().map(({ id, widgetName }) => [id, widgetName]),
        ).toEqual([
            ['previewer::v1', 'Slides'],
            ['previewer::v2', 'Note'],
        ]);
    });

    test('a pane inside a floating widget stays out of the menu', () => {
        // The floating preview of a song beside the main panel's slide
        // document handed the menu a second "Slides".
        act(() => {
            root.render(
                <WidgetMenuExcludedContext value={true}>
                    <PanesComp />
                </WidgetMenuExcludedContext>,
            );
        });
        expect(getWidgetEntries()).toEqual([]);
        expect(container.querySelectorAll('[data-widget-name]')).toHaveLength(
            2,
        );
    });

    test('unmounting withdraws the entries again', () => {
        act(() => {
            root.render(<PanesComp />);
        });
        act(() => {
            root.render(<div />);
        });
        expect(getWidgetEntries()).toEqual([]);
    });
});
