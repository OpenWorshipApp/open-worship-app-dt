// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    actorProps: [] as any[],
}));

vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { bibleReadingLeft: 'bible-reading-left' },
}));
vi.mock('../resize-actor/ResizeActorDynamicComp', () => ({
    default: (props: any) => {
        h.actorProps.push(props);
        return <div className="resize-actor" />;
    },
}));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (labelKey: string) => ({
        widgetName: `[${labelKey}]`,
        widgetKey: labelKey,
    }),
}));
vi.mock('./BibleListComp', () => ({
    default: () => <div className="pane">Bible list</div>,
}));
vi.mock('./note/BibleNoteListComp', () => ({
    default: () => <div className="pane">Bible note list</div>,
}));

import BibleReadingLeftComp from './BibleReadingLeftComp';

let host: HTMLDivElement;
let root: Root;

function lastProps() {
    return h.actorProps.at(-1);
}

async function renderPane(Target: any) {
    const paneHost = document.createElement('div');
    const paneRoot = createRoot(paneHost);
    await act(async () => {
        paneRoot.render(
            <Suspense fallback={null}>
                <Target />
            </Suspense>,
        );
    });
    await vi.waitFor(() => {
        expect(paneHost.textContent).not.toBe('');
    });
    const text = paneHost.textContent;
    await act(async () => paneRoot.unmount());
    return text;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.actorProps = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the Bibles and Bible Notes column', () => {
    test('splits into the bible lists and the notes, side by side or stacked', async () => {
        await act(async () => root.render(<BibleReadingLeftComp />));
        const { flexSizeName, data } = lastProps();
        expect(flexSizeName).toBe('bible-reading-left');
        expect(data.minWidth).toBe(400);
        expect(data.horizontal.flexSizeDefault).toEqual({
            h1: ['1'],
            h2: ['1'],
        });
        expect(data.vertical.flexSizeDefault).toEqual({
            v1: ['1'],
            v2: ['1'],
        });
        const toPanes = (dataInput: any[]) =>
            dataInput.map(({ key, widgetName, widgetKey }) => ({
                key,
                widgetName,
                widgetKey,
            }));
        expect(toPanes(data.horizontal.dataInput)).toEqual([
            { key: 'h1', widgetName: '[Bibles]', widgetKey: 'Bibles' },
            {
                key: 'h2',
                widgetName: '[Bible Notes]',
                widgetKey: 'Bible Notes',
            },
        ]);
        expect(toPanes(data.vertical.dataInput).map(({ key }) => key)).toEqual([
            'v1',
            'v2',
        ]);
        // Each pane loads its own list only when it is shown.
        expect(await renderPane(data.horizontal.dataInput[0].children)).toBe(
            'Bible list',
        );
        expect(await renderPane(data.vertical.dataInput[1].children)).toBe(
            'Bible note list',
        );
    });

    test('a second mount on one page takes its own names and size key', async () => {
        await act(async () =>
            root.render(
                <BibleReadingLeftComp
                    flexSizeName="bible-reading-left-lookup"
                    biblesLabel="Lookup Bibles"
                    bibleNotesLabel="Lookup Bible Notes"
                />,
            ),
        );
        const { flexSizeName, data } = lastProps();
        expect(flexSizeName).toBe('bible-reading-left-lookup');
        expect(
            data.horizontal.dataInput.map((input: any) => input.widgetKey),
        ).toEqual(['Lookup Bibles', 'Lookup Bible Notes']);
        expect(
            data.vertical.dataInput.map((input: any) => input.widgetName),
        ).toEqual(['[Lookup Bibles]', '[Lookup Bible Notes]']);
    });

    test('the pane lists are built once per set of names', async () => {
        await act(async () => root.render(<BibleReadingLeftComp />));
        const first = lastProps().data.horizontal.dataInput;
        await act(async () => root.render(<BibleReadingLeftComp />));
        expect(lastProps().data.horizontal.dataInput).toBe(first);
        await act(async () =>
            root.render(<BibleReadingLeftComp biblesLabel="Bible Lists" />),
        );
        expect(lastProps().data.horizontal.dataInput).not.toBe(first);
        expect(lastProps().data.horizontal.dataInput[0].widgetKey).toBe(
            'Bible Lists',
        );
    });
});
