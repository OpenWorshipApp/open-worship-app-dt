// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    doFinding: vi.fn(),
    controller: null as any,
    dataProps: null as any,
    headerProps: null as any,
    infoProps: null as any,
    keyProps: null as any,
}));

vi.mock('./bibleFindHelpers', () => ({ doFinding: h.doFinding }));
vi.mock('./BibleFindRenderDataComp', () => ({
    default: (props: any) => {
        h.dataProps = props;
        return <div className="find-data" />;
    },
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    default: (props: any) => {
        h.keyProps = props;
        return <div className="bible-key" />;
    },
}));
vi.mock('./BibleFindHeaderComp', () => ({
    default: (props: any) => {
        h.headerProps = props;
        return <div className="find-header" />;
    },
}));
vi.mock('./RenderFindingInfoHeaderComp', () => ({
    default: (props: any) => {
        h.infoProps = props;
        return <div className="find-info" />;
    },
}));
vi.mock('./BibleFindController', () => ({
    useBibleFindController: () => h.controller,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            effect: (context: object) => Promise<unknown>,
            deps: unknown[],
            methods: object = {},
        ) => {
            useEffect(
                () => {
                    void effect({ ...methods });
                },
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [...deps, ...Object.values(methods)],
            );
        },
        useAppStateAsync: (callee: () => unknown) => {
            const [value, setValue] = useState<unknown>(undefined);
            useEffect(() => {
                Promise.resolve(callee()).then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return [value, setValue];
        },
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import BibleFindBodyComp from './BibleFindBodyComp';
import type { FindDataType } from './bibleFindHelpers';

let host: HTMLDivElement;
let root: Root;
let setBibleKey: Mock<(_: string, newBibleKey: string) => void>;

const FOUND: FindDataType = {
    pagingData: { pages: ['1', '2', '3'], currentPage: '1', perPage: 20 },
    foundData: {
        '1': {
            maxLineNumber: 45,
            fromLineNumber: 0,
            toLineNumber: 19,
            content: [],
        },
        '2': null,
        '3': undefined,
    },
};

async function renderBody() {
    await act(async () => {
        root.render(<BibleFindBodyComp setBibleKey={setBibleKey} />);
    });
}

function lastFindingCall() {
    return h.doFinding.mock.calls.at(-1)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.dataProps = null;
    h.headerProps = null;
    h.infoProps = null;
    h.keyProps = null;
    h.doFinding.mockResolvedValue(undefined);
    h.controller = {
        bibleKey: 'KJV',
        selectedBookKeys: [] as string[],
        getSelectedBooks: vi.fn(async () => [
            { bookKey: 'GEN', book: 'Genesis' },
        ]),
    };
    setBibleKey = vi.fn<(_: string, newBibleKey: string) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the Find panel body', () => {
    test('wires the Bible picker, the search box and the filter to this controller', async () => {
        await renderBody();
        expect(h.keyProps.bibleKey).toBe('KJV');
        expect(h.keyProps.onBibleKeyChange).toBe(setBibleKey);
        expect(h.infoProps.bibleKey).toBe('KJV');
        expect(h.infoProps.selectedBooks).toEqual([
            { bookKey: 'GEN', book: 'Genesis' },
        ]);
        expect(h.infoProps.findText).toBe('');
        // Nothing typed: nothing to find.
        expect(h.dataProps.data).toBeNull();
        expect(h.dataProps.findText).toBe('');
    });

    test('the filter starts empty until the stored books are read', async () => {
        h.controller.getSelectedBooks = vi.fn(() => new Promise(() => {}));
        await renderBody();
        expect(h.infoProps.selectedBooks).toEqual([]);
    });

    test('typed words start a find, whose result reaches the list', async () => {
        await renderBody();
        await act(async () => h.headerProps.handleFinding('grace'));
        expect(h.dataProps.findText).toBe('grace');
        expect(h.infoProps.findText).toBe('grace');
        const [controller, text, data, setData] = lastFindingCall();
        expect(controller).toBe(h.controller);
        expect(text).toBe('grace');
        // `undefined` is the "finding" state the list shows a spinner for.
        expect(data).toBeUndefined();
        expect(h.dataProps.data).toBeUndefined();
        await act(async () => setData(FOUND));
        expect(h.dataProps.data).toBe(FOUND);
    });

    test('clearing the words clears the result', async () => {
        await renderBody();
        await act(async () => h.headerProps.handleFinding('grace'));
        await act(async () => lastFindingCall()[3](FOUND));
        await act(async () => h.headerProps.handleFinding(''));
        expect(h.dataProps.data).toBeNull();
    });

    test('the same words again only search again when asked to refresh', async () => {
        await renderBody();
        await act(async () => h.headerProps.handleFinding('grace'));
        const callCount = h.doFinding.mock.calls.length;
        await act(async () => h.headerProps.handleFinding('grace'));
        expect(h.doFinding).toHaveBeenCalledTimes(callCount);
        await act(async () => h.headerProps.handleFinding('grace', true));
        expect(h.doFinding).toHaveBeenCalledTimes(callCount + 1);
        const [controller, text, data] = lastFindingCall();
        expect(controller).toBe(h.controller);
        expect(text).toBe('grace');
        expect(data).toBeUndefined();
    });

    test('changing the book filter stores it and finds again', async () => {
        await renderBody();
        await act(async () => h.headerProps.handleFinding('grace'));
        await act(async () => lastFindingCall()[3](FOUND));
        expect(h.dataProps.data).toBe(FOUND);
        await act(async () =>
            h.infoProps.setSelectedBooks([
                { bookKey: 'EXO', book: 'Exodus' },
                { bookKey: 'LEV', book: 'Leviticus' },
            ]),
        );
        expect(h.controller.selectedBookKeys).toEqual(['EXO', 'LEV']);
        expect(h.infoProps.selectedBooks).toEqual([
            { bookKey: 'EXO', book: 'Exodus' },
            { bookKey: 'LEV', book: 'Leviticus' },
        ]);
        expect(h.dataProps.data).toBeUndefined();
    });

    test('a chunk number asks for that chunk only once', async () => {
        await renderBody();
        await act(async () => h.headerProps.handleFinding('grace'));
        await act(async () => lastFindingCall()[3](FOUND));
        await act(async () => h.dataProps.findFor('2'));
        const requested = h.dataProps.data as FindDataType;
        expect(requested).not.toBe(FOUND);
        expect(requested.pagingData).toBe(FOUND.pagingData);
        expect(requested.foundData['1']).toBe(FOUND.foundData['1']);
        expect('2' in requested.foundData).toBe(true);
        expect(requested.foundData['2']).toBeUndefined();
        // The new state is handed to the finder, which loads chunk 2.
        expect(lastFindingCall()[2]).toBe(requested);

        // Already being fetched: nothing changes.
        await act(async () => h.dataProps.findFor('3'));
        expect(h.dataProps.data).toBe(requested);
    });

    test('a chunk number does nothing while there is no result', async () => {
        await renderBody();
        await act(async () => h.dataProps.findFor('1'));
        expect(h.dataProps.data).toBeNull();
    });
});
