// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        controllerList: [] as any[],
        unregisterList: [] as any[],
        registerLookupBibleItemController: vi.fn(),
        lookupProps: null as any,
        readingLeftProps: null as any,
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/AppSuspenseComp', async () => {
    const React = await import('react');
    return {
        default: ({ children }: { children: ReactNode }) => (
            <React.Suspense fallback={<span className="suspended" />}>
                {children}
            </React.Suspense>
        ),
    };
});
vi.mock('./LookupBibleItemController', () => {
    class LookupBibleItemController {
        onLookupSaveBibleItem: (() => void) | null = null;
        constructor() {
            h.controllerList.push(this);
        }
    }
    return {
        default: LookupBibleItemController,
        registerLookupBibleItemController: h.registerLookupBibleItemController,
    };
});
vi.mock('./BibleItemsViewController', async () => {
    const React = await import('react');
    return {
        BibleItemsViewControllerContext: React.createContext<unknown>(null),
    };
});
vi.mock('../bible-lookup/RenderBibleLookupComp', async () => {
    const React = await import('react');
    const { BibleItemsViewControllerContext } =
        await import('./BibleItemsViewController');
    return {
        default: (props: any) => {
            h.lookupProps = {
                ...props,
                controller: React.use(BibleItemsViewControllerContext as any),
            };
            return (
                <div
                    className="lookup"
                    data-flex-size-name={props.flexSizeName}
                >
                    {props.leadingWidgets.map((widget: any) => (
                        <div key={widget.key} className="leading-widget">
                            {widget.children.render()}
                        </div>
                    ))}
                </div>
            );
        },
    };
});
vi.mock('../bible-list/BibleReadingLeftComp', () => ({
    default: (props: any) => {
        h.readingLeftProps = props;
        return <div className="reading-left" />;
    },
}));

import BibleReaderComp from './BibleReaderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function renderReader(element: ReactElement) {
    await act(async () => {
        root.render(element);
    });
    // Both panes are lazy: let their modules resolve.
    await act(async () => {
        for (let i = 0; i < 10; i++) {
            await Promise.resolve();
        }
    });
}

beforeEach(() => {
    h.controllerList = [];
    h.unregisterList = [];
    h.lookupProps = null;
    h.readingLeftProps = null;
    h.registerLookupBibleItemController.mockImplementation(() => {
        const unregister = vi.fn();
        h.unregisterList.push(unregister);
        return unregister;
    });
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

describe('BibleReaderComp', () => {
    test('opens the lookup on its own controller, with the bibles and notes beside it', async () => {
        await renderReader(<BibleReaderComp flexSizeName="reader-flex" />);
        expect(
            host.querySelector('.lookup')!.getAttribute('data-flex-size-name'),
        ).toBe('reader-flex');
        expect(h.controllerList).toHaveLength(1);
        const [controller] = h.controllerList;
        expect(h.lookupProps.controller).toBe(controller);
        expect(controller.onLookupSaveBibleItem).toBeNull();

        const [widget] = h.lookupProps.leadingWidgets;
        expect(h.lookupProps.leadingWidgets).toHaveLength(1);
        expect(widget).toMatchObject({
            key: 'h1',
            widgetName: 'Bible and Notes',
            widgetKey: 'Bible and Notes',
        });
        expect(
            host.querySelector('.leading-widget .reading-left'),
        ).not.toBeNull();
        // The component's own defaults apply when the caller names nothing.
        expect(h.readingLeftProps).toEqual({
            flexSizeName: undefined,
            biblesLabel: undefined,
            bibleNotesLabel: undefined,
        });
    });

    test('publishes its controller for the window, and takes it back when it goes', async () => {
        await renderReader(<BibleReaderComp flexSizeName="reader-flex" />);
        const [controller] = h.controllerList;
        expect(h.registerLookupBibleItemController).toHaveBeenCalledWith(
            controller,
        );
        expect(h.unregisterList[0]).not.toHaveBeenCalled();
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(h.unregisterList[0]).toHaveBeenCalledTimes(1);
    });

    test('the lookup popup names its panes apart and saves through its own callback', async () => {
        const onLookupSaveBibleItem = vi.fn();
        await renderReader(
            <BibleReaderComp
                flexSizeName="popup-flex"
                onLookupSaveBibleItem={onLookupSaveBibleItem}
                bibleAndNotesLabel="Lookup Bible and Notes"
                readingLeftFlexSizeName="popup-reading-left"
                readingLeftBiblesLabel="Lookup Bibles"
                readingLeftBibleNotesLabel="Lookup Bible Notes"
            />,
        );
        expect(h.controllerList[0].onLookupSaveBibleItem).toBe(
            onLookupSaveBibleItem,
        );
        expect(h.lookupProps.leadingWidgets[0]).toMatchObject({
            widgetName: 'Lookup Bible and Notes',
            widgetKey: 'Lookup Bible and Notes',
        });
        expect(h.readingLeftProps).toEqual({
            flexSizeName: 'popup-reading-left',
            biblesLabel: 'Lookup Bibles',
            bibleNotesLabel: 'Lookup Bible Notes',
        });
    });

    test('keeps one controller across renders, and makes another for another callback', async () => {
        const onSave = () => {};
        await renderReader(
            <BibleReaderComp flexSizeName="f" onLookupSaveBibleItem={onSave} />,
        );
        await renderReader(
            <BibleReaderComp flexSizeName="f" onLookupSaveBibleItem={onSave} />,
        );
        expect(h.controllerList).toHaveLength(1);
        expect(h.registerLookupBibleItemController).toHaveBeenCalledTimes(1);

        const onOtherSave = () => {};
        await renderReader(
            <BibleReaderComp
                flexSizeName="f"
                onLookupSaveBibleItem={onOtherSave}
            />,
        );
        expect(h.controllerList).toHaveLength(2);
        expect(h.controllerList[1].onLookupSaveBibleItem).toBe(onOtherSave);
        // The old one is taken back before the new one is published.
        expect(h.unregisterList[0]).toHaveBeenCalledTimes(1);
        expect(h.registerLookupBibleItemController).toHaveBeenLastCalledWith(
            h.controllerList[1],
        );
        expect(h.lookupProps.controller).toBe(h.controllerList[1]);
    });
});
