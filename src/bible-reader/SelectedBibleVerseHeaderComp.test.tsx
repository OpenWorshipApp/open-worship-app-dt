// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type KeySelectionPropsType = {
    bibleKey: string;
    onBibleKeyChange: (
        isContextMenu: boolean,
        oldBibleKey: string,
        newBibleKey: string,
    ) => void;
};

const h = vi.hoisted(() => ({
    keySelectionProps: null as null | KeySelectionPropsType,
    editorProps: null as null | Record<string, unknown>,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppStateAsync: <T,>(load: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                void load().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: (props: KeySelectionPropsType) => {
        h.keySelectionProps = props;
        return <span className="test-key">{props.bibleKey}</span>;
    },
}));
vi.mock('./BibleViewTitleEditorComp', () => ({
    default: (props: Record<string, unknown>) => {
        h.editorProps = props;
        return <span className="test-editor" />;
    },
}));

import SelectedBibleVerseHeaderComp from './SelectedBibleVerseHeaderComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.keySelectionProps = null;
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
    vi.unstubAllGlobals();
});

function genBibleItem(text: string) {
    return {
        bibleKey: 'KHM',
        toText: vi.fn(async () => text),
    } as any;
}

describe('SelectedBibleVerseHeaderComp', () => {
    test('names the verse, lets both its parts change, and reads it', async () => {
        const bibleItem = genBibleItem('For God so loved the world');
        const onBibleKeyChange = vi.fn();
        const onTargetChange = vi.fn();
        await act(async () => {
            root.render(
                <SelectedBibleVerseHeaderComp
                    bibleItem={bibleItem}
                    onBibleKeyChange={onBibleKeyChange}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        const block = host.firstElementChild as HTMLDivElement;
        expect(block.style.fontFamily).toBe('KHM Font');
        expect(host.querySelector('.alert .test-key')!.textContent).toBe('KHM');
        // A one-verse editor that waits for the start verse.
        expect(h.editorProps).toEqual({
            bibleItem,
            isOneVerse: true,
            onTargetChange,
            waitUntilGotVerseStart: true,
        });
        const text = block.lastElementChild as HTMLDivElement;
        expect(text.textContent).toBe('For God so loved the world');
        expect(text.style.maxHeight).toBe('75px');
        expect(text.style.fontFamily).toBe('KHM Font');
        expect(bibleItem.toText).toHaveBeenCalledOnce();

        // Only the new key matters to the panel.
        h.keySelectionProps!.onBibleKeyChange(false, 'KHM', 'KJV');
        expect(onBibleKeyChange).toHaveBeenCalledWith('KJV');
    });

    test('another verse is read anew', async () => {
        const render = async (bibleItem: any) => {
            await act(async () => {
                root.render(
                    <SelectedBibleVerseHeaderComp
                        bibleItem={bibleItem}
                        onBibleKeyChange={vi.fn()}
                        onTargetChange={vi.fn()}
                    />,
                );
            });
        };
        await render(genBibleItem('In the beginning'));
        await render(genBibleItem('And the earth was'));
        expect(host.textContent).toContain('And the earth was');
        expect(host.textContent).not.toContain('In the beginning');
    });
});
