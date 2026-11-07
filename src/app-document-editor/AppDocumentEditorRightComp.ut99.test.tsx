// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The editor's right column: the slide editing ground over the background
// panel, both lazy chunks, split vertically with the editor taking most of it.

vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { appEditorRight: 'app-editor-right' },
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: ({
        flexSizeName,
        isHorizontal,
        flexSizeDefault,
        dataInput,
    }: any) => (
        <div
            data-testid="resize"
            data-name={flexSizeName}
            data-horizontal={String(isHorizontal)}
            data-defaults={JSON.stringify(flexSizeDefault)}
        >
            {dataInput.map(
                ({ children: PaneComp, key, widgetName, widgetKey }: any) => (
                    <section
                        key={key}
                        data-key={key}
                        data-widget-name={widgetName}
                        data-widget-key={widgetKey}
                    >
                        <Suspense fallback={<span>Loading</span>}>
                            <PaneComp />
                        </Suspense>
                    </section>
                ),
            )}
        </div>
    ),
}));
vi.mock('../slide-editor/SlideEditorGroundComp', () => ({
    default: () => <div data-testid="ground">Ground</div>,
}));
vi.mock('../background/BackgroundComp', () => ({
    default: () => <div data-testid="background">Backgrounds</div>,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => `~${key}` }));

import AppDocumentEditorRightComp from './AppDocumentEditorRightComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('AppDocumentEditorRightComp', () => {
    test('stacks the editing ground over the backgrounds, each loaded lazily', async () => {
        await act(async () => {
            root.render(<AppDocumentEditorRightComp />);
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        const resize = container.querySelector<HTMLElement>(
            '[data-testid="resize"]',
        )!;
        expect(resize.dataset.name).toBe('app-editor-right');
        expect(resize.dataset.horizontal).toBe('false');
        expect(JSON.parse(resize.dataset.defaults!)).toEqual({
            v1: ['4'],
            v2: ['1'],
        });
        const panes = [...resize.querySelectorAll<HTMLElement>('section')];
        expect(
            panes.map((pane) => [
                pane.dataset.key,
                pane.dataset.widgetName,
                pane.dataset.widgetKey,
                pane.textContent,
            ]),
        ).toEqual([
            ['v1', '~Slide Editor Ground', 'Slide Editor Ground', 'Ground'],
            ['v2', '~Background', 'Background', 'Backgrounds'],
        ]);
    });
});
