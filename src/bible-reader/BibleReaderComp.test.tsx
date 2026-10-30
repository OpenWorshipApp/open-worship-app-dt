// @vitest-environment jsdom

import { act, use, type Context, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type LeadingWidgetType = {
    key: string;
    widgetName: string;
    widgetKey: string;
    children: { render: () => ReactNode };
};
type LookupPropsType = {
    flexSizeName: string;
    leadingWidgets: LeadingWidgetType[];
};

const h = vi.hoisted(() => ({
    context: null as null | Context<unknown>,
    controllers: [] as { onLookupSaveBibleItem: unknown }[],
    registered: [] as unknown[],
    unregistered: [] as unknown[],
    defaultSave: () => {},
    lookupRenders: [] as { props: LookupPropsType; controller: unknown }[],
    readingLeftProps: [] as Record<string, unknown>[],
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="test-loading" />,
}));
vi.mock('./LookupBibleItemController', () => ({
    default: class {
        onLookupSaveBibleItem = h.defaultSave;
        constructor() {
            h.controllers.push(this);
        }
    },
    registerLookupBibleItemController: (controller: unknown) => {
        h.registered.push(controller);
        return () => {
            h.unregistered.push(controller);
        };
    },
}));
vi.mock('./BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    h.context = createContext<unknown>(null);
    return { BibleItemsViewControllerContext: h.context };
});
vi.mock('../bible-lookup/RenderBibleLookupComp', () => ({
    default: (props: LookupPropsType) => {
        h.lookupRenders.push({ props, controller: use(h.context!) });
        return (
            <div className="test-lookup">
                {props.leadingWidgets.map((widget) => (
                    <div key={widget.key} className="test-widget">
                        {widget.children.render()}
                    </div>
                ))}
            </div>
        );
    },
}));
vi.mock('../bible-list/BibleReadingLeftComp', () => ({
    default: (props: Record<string, unknown>) => {
        h.readingLeftProps.push(props);
        return <div className="test-reading-left" />;
    },
}));

import BibleReaderComp from './BibleReaderComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.controllers = [];
    h.registered = [];
    h.unregistered = [];
    h.lookupRenders = [];
    h.readingLeftProps = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(element: ReactNode) {
    await act(async () => {
        root.render(element);
    });
    // The two lazy panes resolve on their own ticks.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('BibleReaderComp', () => {
    test('gives the lookup its own controller, published for the window', async () => {
        await render(<BibleReaderComp flexSizeName="reader-main" />);
        expect(host.querySelector('.test-lookup')).not.toBeNull();
        const [controller] = h.controllers;
        const { props, controller: provided } = h.lookupRenders.at(-1)!;
        expect(provided).toBe(controller);
        expect(props.flexSizeName).toBe('reader-main');
        expect(h.registered).toEqual([controller]);
        // Nothing to save to: the controller keeps its own default.
        expect(controller.onLookupSaveBibleItem).toBe(h.defaultSave);
    });

    test('the bible and notes pane comes first, with the reading panes inside', async () => {
        await render(<BibleReaderComp flexSizeName="reader-main" />);
        const [widget] = h.lookupRenders.at(-1)!.props.leadingWidgets;
        expect(widget).toMatchObject({
            key: 'h1',
            widgetName: 'Bible and Notes',
            widgetKey: 'Bible and Notes',
        });
        expect(
            host.querySelector('.test-widget .test-reading-left'),
        ).not.toBeNull();
        // Left to the reading panes' own defaults.
        expect(h.readingLeftProps.at(-1)).toEqual({
            flexSizeName: undefined,
            biblesLabel: undefined,
            bibleNotesLabel: undefined,
        });
    });

    test('the lookup popup names its panes apart from the presenter', async () => {
        const onLookupSaveBibleItem = vi.fn();
        await render(
            <BibleReaderComp
                flexSizeName="lookup-popup"
                onLookupSaveBibleItem={onLookupSaveBibleItem}
                bibleAndNotesLabel="Lookup Bible and Notes"
                readingLeftFlexSizeName="lookup-reading-left"
                readingLeftBiblesLabel="Lookup Bibles"
                readingLeftBibleNotesLabel="Lookup Bible Notes"
            />,
        );
        expect(h.controllers[0].onLookupSaveBibleItem).toBe(
            onLookupSaveBibleItem,
        );
        expect(h.lookupRenders.at(-1)!.props.leadingWidgets[0]).toMatchObject({
            widgetName: 'Lookup Bible and Notes',
            widgetKey: 'Lookup Bible and Notes',
        });
        expect(h.readingLeftProps.at(-1)).toEqual({
            flexSizeName: 'lookup-reading-left',
            biblesLabel: 'Lookup Bibles',
            bibleNotesLabel: 'Lookup Bible Notes',
        });
    });

    test('the controller lives as long as its save callback does', async () => {
        const onSave = vi.fn();
        await render(
            <BibleReaderComp flexSizeName="a" onLookupSaveBibleItem={onSave} />,
        );
        await render(
            <BibleReaderComp flexSizeName="b" onLookupSaveBibleItem={onSave} />,
        );
        expect(h.controllers).toHaveLength(1);

        await render(
            <BibleReaderComp
                flexSizeName="b"
                onLookupSaveBibleItem={vi.fn()}
            />,
        );
        expect(h.controllers).toHaveLength(2);
        // The old controller steps down as the new one is published.
        expect(h.unregistered).toEqual([h.controllers[0]]);
        expect(h.registered).toEqual(h.controllers);

        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(h.unregistered).toEqual(h.controllers);
    });
});
