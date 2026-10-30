// @vitest-environment jsdom

import { act, Suspense, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ props: null as any }));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: {
        appPresenterLeft: 'app-presenter-left',
        appPresenterMiddle: 'app-presenter-middle',
        appPresenterRight: 'app-presenter-right',
    },
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
vi.mock('../app-document-presenter/PresenterComp', () => ({
    default: () => <p>presenter</p>,
}));
vi.mock('../background/BackgroundComp', () => ({
    default: () => <p>background</p>,
}));

import AppPresenterMiddleComp from './AppPresenterMiddleComp';

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

describe('AppPresenterMiddleComp', () => {
    test('stacks the presenter over the backgrounds, 3 to 1', async () => {
        await act(async () => root.render(<AppPresenterMiddleComp />));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(state.props.flexSizeName).toBe('app-presenter-middle');
        expect(state.props.isHorizontal).toBe(false);
        expect(state.props.flexSizeDefault).toEqual({
            v1: ['3'],
            v2: ['1'],
        });
        expect(
            state.props.dataInput.map((item: any) => [
                item.key,
                item.widgetKey,
                item.widgetIconName,
                item.className,
            ]),
        ).toEqual([
            ['v1', 'Presenter', 'display', 'app-flex-item'],
            ['v2', 'Background', 'card-image', 'app-flex-item'],
        ]);
        expect(host.querySelector('[data-key="v1"]')!.textContent).toBe(
            'presenter',
        );
        expect(host.querySelector('[data-key="v2"]')!.textContent).toBe(
            'background',
        );
    });
});
