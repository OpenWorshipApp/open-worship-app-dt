// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    paths: [] as string[],
    files: new Map<string, any>(),
    notes: new Map<string, any>(),
    reads: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    highlight: vi.fn(),
    parseText: vi.fn((text: string) =>
        [...text.matchAll(/GEN \d+:\d+/g)].map(([verse]) => verse),
    ),
    update: null as null | ((data: { filePath: string }) => Promise<void>),
}));

vi.mock('../../helper/DirSource', () => ({
    default: {
        getInstance: async () => ({
            dirPath: '/notes',
            getFilePaths: async () => h.paths,
        }),
    },
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: filePath,
            name: filePath.split('/').at(-1),
            readFileJsonData: async () => {
                h.reads(filePath);
                return h.files.get(filePath);
            },
        }),
        registerFileSourcePathEventListener: h.register,
        unregisterEventListener: h.unregister,
    },
}));
vi.mock('./Note', () => ({
    default: {
        mimetypeName: 'note',
        fromFilePath: async (filePath: string) => h.notes.get(filePath) ?? null,
    },
}));
vi.mock('../../helper/domHelpers', () => ({
    escapeSelectorValue: (value: string) => value,
    notifyElementHighlight: h.highlight,
}));
vi.mock('../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../../server/fileHelpers', () => ({ pathSeparator: '/' }));
vi.mock('./noteItemHelpers', () => ({
    toValidVerseHighlights: (value: unknown) =>
        Array.isArray(value) ? value : [],
    toValidVerseComments: (value: unknown) =>
        Array.isArray(value) ? value : [],
}));
vi.mock('bible-note', () => ({
    BibleNote: {
        getAllShortVersesFromText: h.parseText,
    },
}));

import {
    fromBibleNoteRef,
    revealBibleNoteRefs,
    toBibleNoteRef,
    useBibleVerseAnnotations,
    useShortBibleNoteVerses,
} from './bibleNoteShortVerseHelpers';

let host: HTMLDivElement;
let root: Root;

function IndexProbe() {
    const refs = useShortBibleNoteVerses();
    const marks = useBibleVerseAnnotations();
    return <pre>{JSON.stringify({ refs, marks })}</pre>;
}

function snapshot() {
    return JSON.parse(host.textContent ?? '{}') as {
        refs: Record<string, string[]>;
        marks: Record<string, { highlights: any[]; comments: any[] }>;
    };
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.paths = [];
    h.files.clear();
    h.notes.clear();
    h.reads.mockClear();
    h.register.mockClear();
    h.register.mockImplementation((_events, listener) => {
        h.update = listener;
        return ['update'];
    });
    h.unregister.mockClear();
    h.highlight.mockClear();
    h.parseText.mockClear();
    h.update = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

test('one scan indexes plain notes and translation-scoped verse marks', async () => {
    h.paths = ['/notes/one.own', '/notes/two.own'];
    h.files.set('/notes/one.own', {
        items: [
            { metadata: { id: 1 }, content: 'GEN 1:1 and GEN 1:2' },
            {
                metadata: { id: 2 },
                verseKey: '(KJV) GEN 1:1',
                highlights: [{ id: 'yellow' }],
                comments: [{ id: 'comment' }],
            },
            { metadata: { id: 3 }, content: '' },
            { metadata: {}, content: 'GEN 1:3' },
        ],
    });
    h.files.set('/notes/two.own', {
        items: [
            {
                metadata: { id: 4 },
                verseKey: '(WEB) GEN 1:1',
                highlights: [{ id: 'blue' }],
            },
        ],
    });

    await act(async () => root.render(<IndexProbe />));
    await vi.waitFor(() =>
        expect(snapshot().refs['GEN 1:1']).toEqual([
            '/notes/one.own@2',
            '/notes/one.own@1',
            '/notes/two.own@4',
        ]),
    );
    expect(snapshot().refs['GEN 1:2']).toEqual(['/notes/one.own@1']);
    expect(snapshot().marks['(KJV) GEN 1:1'].highlights).toEqual([
        {
            filePath: '/notes/one.own',
            noteItemId: 2,
            highlight: { id: 'yellow' },
        },
    ]);
    expect(snapshot().marks['(KJV) GEN 1:1'].comments).toEqual([
        {
            filePath: '/notes/one.own',
            noteItemId: 2,
            comment: { id: 'comment' },
        },
    ]);
    expect(snapshot().marks['(WEB) GEN 1:1'].highlights[0].highlight.id).toBe(
        'blue',
    );
    expect(h.reads).toHaveBeenCalledTimes(2);
    expect(h.parseText).toHaveBeenCalledTimes(2);
    expect(h.register).toHaveBeenCalledTimes(1);
});

test('only a save inside the notes folder refreshes both indexes', async () => {
    h.paths = ['/notes/one.own'];
    h.files.set('/notes/one.own', {
        items: [{ metadata: { id: 1 }, verseKey: '(KJV) GEN 1:1' }],
    });
    await act(async () => root.render(<IndexProbe />));
    await vi.waitFor(() =>
        expect(snapshot().refs['GEN 1:1']).toEqual(['/notes/one.own@1']),
    );
    expect(h.register).toHaveBeenCalledTimes(1);
    expect(h.parseText).not.toHaveBeenCalled();
    const reads = h.reads.mock.calls.length;
    await act(async () => h.update?.({ filePath: '/other/one.own' }));
    expect(h.reads).toHaveBeenCalledTimes(reads);

    h.files.set('/notes/one.own', {
        items: [{ metadata: { id: 2 }, verseKey: '(KJV) GEN 2:3' }],
    });
    expect(h.update).not.toBeNull();
    await act(async () => {
        await h.update?.({ filePath: '/notes/one.own' });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(h.reads).toHaveBeenCalledTimes(reads + 1);
    await vi.waitFor(() =>
        expect(snapshot().refs['GEN 2:3']).toEqual(['/notes/one.own@2']),
    );
    expect(snapshot().refs['GEN 1:1']).toBeUndefined();
    expect(h.reads).toHaveBeenCalledTimes(reads + 1);
});

test('revealing several refs opens each file once and skips bad refs', async () => {
    const opened = { isOpened: false, setIsOpened: vi.fn(async () => {}) };
    const alreadyOpen = { isOpened: true, setIsOpened: vi.fn() };
    h.notes.set('/notes/one.own', opened);
    h.notes.set('/notes/two.own', alreadyOpen);
    expect(fromBibleNoteRef('/notes/a@b.own@12')).toEqual({
        filePath: '/notes/a@b.own',
        noteItemId: 12,
    });
    expect(fromBibleNoteRef('bad')).toBeNull();
    expect(fromBibleNoteRef('/notes/a.own@oops')).toBeNull();
    expect(toBibleNoteRef('/notes/one.own', 3)).toBe('/notes/one.own@3');

    expect(
        await revealBibleNoteRefs([
            '/notes/one.own@1',
            '/notes/one.own@2',
            '/notes/two.own@4',
            'invalid',
        ]),
    ).toBe(2);
    expect(opened.setIsOpened).toHaveBeenCalledTimes(1);
    expect(opened.setIsOpened).toHaveBeenCalledWith(true);
    expect(alreadyOpen.setIsOpened).not.toHaveBeenCalled();
    expect(h.highlight).toHaveBeenCalledTimes(5);
    expect(h.highlight.mock.calls[0][1]).toEqual({});
    expect(h.highlight.mock.calls[1][1]).toEqual({});
    expect(h.highlight.mock.calls[2][1]).toHaveProperty('moveToView');
    expect(h.highlight.mock.calls[3][1]).toHaveProperty('moveToView');
});
