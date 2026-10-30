// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bibleCrossRef: undefined as unknown,
    refresh: vi.fn(),
    useGetBibleCrossRefAnthropic: vi.fn(),
    useGenRefreshRef: vi.fn(),
    listProps: null as null | { index: number; bibleCrossRef: unknown },
}));

vi.mock('../helper/ai/anthropicBibleCrossRefHelpers', () => ({
    useGetBibleCrossRefAnthropic: h.useGetBibleCrossRefAnthropic,
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

import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';

let host: HTMLDivElement;
let root: Root;
const ref = createRef<any>() as { current: any };

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.bibleCrossRef = undefined;
    h.listProps = null;
    h.useGetBibleCrossRefAnthropic.mockImplementation(() => ({
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
            <BibleCrossRefAnthropicItemRendererBodyComp
                ref={ref}
                bookKey="JHN"
                chapter={3}
                verse={16}
                index={1}
            />,
        );
    });
}

describe('BibleCrossRefAnthropicItemRendererBodyComp', () => {
    test('asks for the verse and hands its refresh to the section', async () => {
        await render();
        expect(h.useGetBibleCrossRefAnthropic).toHaveBeenCalledWith(
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
