// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bringDomToTopView: vi.fn(),
}));

vi.mock('./RenderFoundItemComp', () => ({
    default: ({ text }: { text: string }) => (
        <div className="found-item">{text}</div>
    ),
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="loading">Loading</div>,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToTopView: h.bringDomToTopView,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BibleFindRenderPerPageComp, {
    APP_FOUND_PAGE_CLASS,
} from './BibleFindRenderPerPageComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('one chunk of Find results', () => {
    test('a chunk with no items yet is a spinner', async () => {
        await act(async () => {
            root.render(
                <BibleFindRenderPerPageComp
                    page="3"
                    items={undefined}
                    fromNumber={41}
                    toNumber={60}
                    findText="grace"
                    bibleKey="KJV"
                />,
            );
        });
        expect(host.querySelector('.loading')).not.toBeNull();
        expect(host.querySelector(`.${APP_FOUND_PAGE_CLASS}-3`)).toBeNull();
    });

    test('a chunk heads its verses with their range and is brought into view after a second', async () => {
        await act(async () => {
            root.render(
                <BibleFindRenderPerPageComp
                    page="2"
                    items={[
                        { text: 'GEN.1:21:And God created', uniqueKey: 'a' },
                        { text: 'GEN.1:22:And God blessed', uniqueKey: 'b' },
                    ]}
                    fromNumber={1021}
                    toNumber={1040}
                    findText="God"
                    bibleKey="KJV"
                />,
            );
        });
        const divider = host.querySelector(`.${APP_FOUND_PAGE_CLASS}-2`)!;
        expect(divider.textContent).toBe(
            `Results ${(1021).toLocaleString()}–${(1040).toLocaleString()}`,
        );
        expect(
            [...host.querySelectorAll('.found-item')].map(
                (item) => item.textContent,
            ),
        ).toEqual(['GEN.1:21:And God created', 'GEN.1:22:And God blessed']);
        await act(async () => {
            vi.advanceTimersByTime(999);
        });
        expect(h.bringDomToTopView).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(1);
        });
        expect(h.bringDomToTopView).toHaveBeenCalledWith(divider);
    });
});
