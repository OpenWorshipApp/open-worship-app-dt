// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        editorProps: null as any,
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                Promise.resolve(callee()).then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `Font ${bibleKey}`,
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: ({ bibleKey, onBibleKeyChange }: any) => (
        <button
            type="button"
            className="bible-key-pill"
            data-bible-key={bibleKey}
            onClick={() => onBibleKeyChange(false, bibleKey, 'NIV')}
        />
    ),
}));
vi.mock('./BibleViewTitleEditorComp', () => ({
    default: (props: any) => {
        h.editorProps = props;
        return <span className="title-editor" />;
    },
}));

import SelectedBibleVerseHeaderComp from './SelectedBibleVerseHeaderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    id: 1,
    bibleKey: 'XXB',
    target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 },
    toText: async () => '♡ ✝ ☀ ♡',
} as any;

let host: HTMLDivElement;
let root: Root;

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

async function renderHeader(
    onBibleKeyChange: (bibleKey: string) => void,
    onTargetChange: (target: unknown) => void,
) {
    await act(async () => {
        root.render(
            <SelectedBibleVerseHeaderComp
                bibleItem={bibleItem}
                onBibleKeyChange={onBibleKeyChange}
                onTargetChange={onTargetChange}
            />,
        );
    });
    await act(async () => {
        await Promise.resolve();
    });
}

describe('SelectedBibleVerseHeaderComp', () => {
    test('names the verse by its version, its editable reference and its text', async () => {
        const onTargetChange = vi.fn();
        await renderHeader(() => {}, onTargetChange);
        const block = host.firstElementChild as HTMLElement;
        expect(block.style.fontFamily).toBe('Font XXB');
        expect(
            host
                .querySelector('.bible-key-pill')!
                .getAttribute('data-bible-key'),
        ).toBe('XXB');
        // One verse, and nothing applied until its start verse is picked.
        expect(h.editorProps).toMatchObject({
            bibleItem,
            isOneVerse: true,
            waitUntilGotVerseStart: true,
        });
        expect(h.editorProps.onTargetChange).toBe(onTargetChange);
        const text = block.lastElementChild as HTMLElement;
        expect(text.textContent).toBe('♡ ✝ ☀ ♡');
        expect(text.style.fontFamily).toBe('Font XXB');
        expect(text.style.maxHeight).toBe('75px');
    });

    test('another version is handed on as its key alone', async () => {
        const onBibleKeyChange = vi.fn();
        await renderHeader(onBibleKeyChange, () => {});
        await act(async () => {
            host.querySelector<HTMLElement>('.bible-key-pill')!.click();
        });
        expect(onBibleKeyChange.mock.calls).toEqual([['NIV']]);
    });
});
