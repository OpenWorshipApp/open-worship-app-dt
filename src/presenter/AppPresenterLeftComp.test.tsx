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
                    (item: {
                        key: string;
                        children: ComponentType;
                        className?: string;
                    }) => (
                        <section
                            key={item.key}
                            data-key={item.key}
                            className={item.className}
                        >
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
vi.mock('../app-document-list/VaryAppDocumentListComp', () => ({
    default: () => <p>document list</p>,
}));
vi.mock('../presenting-flow/PresentingFlowListComp', () => ({
    default: () => <p>presenting flow list</p>,
}));

import AppPresenterLeftComp from './AppPresenterLeftComp';

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

describe('AppPresenterLeftComp', () => {
    test('stacks the document list over the presenting flows, 3 to 2', async () => {
        await act(async () => root.render(<AppPresenterLeftComp />));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(state.props.flexSizeName).toBe('app-presenter-left');
        expect(state.props.isHorizontal).toBe(false);
        expect(state.props.flexSizeDefault).toEqual({
            v1: ['3'],
            v2: ['2'],
        });
        expect(
            state.props.dataInput.map((item: any) => [
                item.key,
                item.widgetKey,
                item.widgetName,
                item.widgetIconName,
                item.className,
            ]),
        ).toEqual([
            [
                'v1',
                'Document List',
                't:Document List',
                'list-ul',
                'app-flex-item',
            ],
            [
                'v2',
                'Presenting Flow List',
                't:Presenting Flow List',
                'collection-play',
                'app-flex-item',
            ],
        ]);
        expect(host.querySelector('[data-key="v1"]')!.textContent).toBe(
            'document list',
        );
        expect(host.querySelector('[data-key="v2"]')!.textContent).toBe(
            'presenting flow list',
        );
    });
});
