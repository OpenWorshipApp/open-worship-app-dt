// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    wrapperProps: null as null | Record<string, unknown>,
    editorProps: null as null | Record<string, unknown>,
}));

vi.mock('./BibleViewTitleWrapperComp', () => ({
    default: ({
        children,
        ...props
    }: {
        children: ReactNode;
        bibleKey: string;
    }) => {
        h.wrapperProps = props;
        return <span className="test-wrapper">{children}</span>;
    },
}));
vi.mock('../BibleViewTitleEditorComp', () => ({
    default: (props: Record<string, unknown>) => {
        h.editorProps = props;
        return <span className="test-editor" />;
    },
}));

import { BibleViewTitleEditingComp } from './BibleViewTitleEditingComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

describe('BibleViewTitleEditingComp', () => {
    test('an editable title in the draggable title of its bible', async () => {
        const bibleItem = { id: 1, bibleKey: 'KHM' } as any;
        const onTargetChange = vi.fn();
        await act(async () => {
            root.render(
                <BibleViewTitleEditingComp
                    bibleItem={bibleItem}
                    onTargetChange={onTargetChange}
                >
                    <i className="test-child" />
                </BibleViewTitleEditingComp>,
            );
        });
        expect(h.wrapperProps).toEqual({ bibleKey: 'KHM', bibleItem });
        expect(h.editorProps).toEqual({ bibleItem, onTargetChange });
        const wrapper = host.querySelector('.test-wrapper')!;
        // The editor first, then whatever the caller adds after it.
        expect(wrapper.firstElementChild!.className).toBe('test-editor');
        expect(wrapper.lastElementChild!.className).toBe('test-child');
    });
});
