// @vitest-environment jsdom

import { act, Suspense, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ props: null as any }));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { appEditorRight: 'app-editor-right' },
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        state.props = props;
        return (
            <div>
                {props.dataInput.map(
                    (item: { key: string; children: ComponentType }) => (
                        <section key={item.key} data-key={item.key}>
                            <Suspense fallback={null}>
                                <item.children />
                            </Suspense>
                        </section>
                    ),
                )}
            </div>
        );
    },
}));
vi.mock('../slide-editor/SlideEditorGroundComp', () => ({
    default: () => <p>slide editor ground</p>,
}));
vi.mock('../background/BackgroundComp', () => ({
    default: () => <p>background</p>,
}));

import AppDocumentEditorRightComp from './AppDocumentEditorRightComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.props = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('AppDocumentEditorRightComp', () => {
    test('stacks the slide editor over the backgrounds, 4 to 1', async () => {
        await act(async () => root.render(<AppDocumentEditorRightComp />));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(state.props.flexSizeName).toBe('app-editor-right');
        expect(state.props.isHorizontal).toBe(false);
        expect(state.props.flexSizeDefault).toEqual({
            v1: ['4'],
            v2: ['1'],
        });
        expect(
            state.props.dataInput.map((item: any) => [
                item.key,
                item.widgetKey,
                item.widgetName,
                item.widgetIconName,
            ]),
        ).toEqual([
            [
                'v1',
                'Slide Editor Ground',
                't:Slide Editor Ground',
                'bounding-box',
            ],
            ['v2', 'Background', 't:Background', 'card-image'],
        ]);
        expect(host.querySelector('[data-key="v1"]')!.textContent).toBe(
            'slide editor ground',
        );
        expect(host.querySelector('[data-key="v2"]')!.textContent).toBe(
            'background',
        );
    });
});
