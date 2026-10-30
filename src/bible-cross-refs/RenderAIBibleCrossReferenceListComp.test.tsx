// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./RenderAIBibleCrossReferenceComp', () => ({
    default: ({ crossReference }: { crossReference: { title: string } }) => (
        <div className="test-theme">{crossReference.title}</div>
    ),
}));

import RenderAIBibleCrossReferenceListComp from './RenderAIBibleCrossReferenceListComp';

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

async function render(index: number, bibleCrossRef: any[]) {
    await act(async () => {
        root.render(
            <RenderAIBibleCrossReferenceListComp
                index={index}
                bibleCrossRef={bibleCrossRef}
            />,
        );
    });
    return host.firstElementChild as HTMLDivElement;
}

describe('RenderAIBibleCrossReferenceListComp', () => {
    test('a verse with no references says so', async () => {
        const list = await render(0, []);
        expect(list.className).toBe('');
        expect(list.querySelector('.app-xref-status')!.textContent).toBe(
            'No cross references for this verse',
        );
        expect(host.querySelector('.test-theme')).toBeNull();
    });

    test('counts the themes and their verses before listing them', async () => {
        const list = await render(0, [
            { title: 'Love', verses: ['ROM 5:8', '1JN 4:9'] },
            { title: 'Life', verses: ['JHN 10:10'] },
        ]);
        expect(list.querySelector('.app-xref-meta')!.textContent).toBe(
            '2 Themes · 3 Verses',
        );
        expect(
            Array.from(
                list.querySelectorAll('.app-xref-themes .test-theme'),
            ).map((theme) => theme.textContent),
        ).toEqual(['Love', 'Life']);
    });

    test('a later verse of the passage continues the one above', async () => {
        expect((await render(1, [])).className).toBe('app-xref-continued');
        expect(
            (await render(2, [{ title: 'Love', verses: [] }])).className,
        ).toBe('app-xref-continued');
    });
});
