// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bibleCrossRef: undefined as unknown,
    refresh: vi.fn(),
    useGettingBibleCrossRefAI: vi.fn(),
    useGenRefreshRef: vi.fn(),
    listProps: null as null | { index: number; bibleCrossRef: unknown },
}));

vi.mock('./bibleCrossRefsHelpers', () => ({
    useGettingBibleCrossRefAI: h.useGettingBibleCrossRefAI,
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useGenRefreshRef: h.useGenRefreshRef,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="test-loading" />,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./RenderAIBibleCrossReferenceListComp', () => ({
    default: (props: { index: number; bibleCrossRef: unknown }) => {
        h.listProps = props;
        return <div className="test-list" />;
    },
}));

import BibleCrossRefAIItemRendererBodyComp from './BibleCrossRefAIItemRendererBodyComp';

let host: HTMLDivElement;
let root: Root;
const ref = createRef<any>() as { current: any };

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.bibleCrossRef = undefined;
    h.listProps = null;
    h.useGettingBibleCrossRefAI.mockImplementation(() => ({
        bibleCrossRef: h.bibleCrossRef,
        refresh: h.refresh,
    }));
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

async function render() {
    await act(async () => {
        root.render(
            <BibleCrossRefAIItemRendererBodyComp
                ref={ref}
                aiType="anthropic"
                bibleKey="KHM"
                bookKey="JHN"
                chapter={3}
                verse={16}
                index={1}
            />,
        );
    });
}

describe('BibleCrossRefAIItemRendererBodyComp', () => {
    test('asks for the verse and hands its refresh to the section', async () => {
        await render();
        expect(h.useGettingBibleCrossRefAI).toHaveBeenCalledWith(
            'anthropic',
            'KHM',
            'JHN',
            3,
            16,
        );
        expect(h.useGenRefreshRef).toHaveBeenCalledWith(ref, h.refresh);
    });

    test('loads until the references arrive', async () => {
        await render();
        expect(host.querySelector('.test-loading')).not.toBeNull();
        expect(host.querySelector('.test-list')).toBeNull();
    });

    test('says which verse has no data', async () => {
        h.bibleCrossRef = null;
        await render();
        expect(host.textContent).toBe('Data not available for "JHN 3:16"');
    });

    test('lists the references it found', async () => {
        const references = [{ title: 'Love', verses: ['ROM 5:8'] }];
        h.bibleCrossRef = references;
        await render();
        expect(h.listProps).toEqual({ index: 1, bibleCrossRef: references });
    });
});
