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
vi.mock('../bible-list/BibleReadingLeftComp', () => ({
    default: () => <p>bible and notes</p>,
}));
vi.mock('../_screen/preview/MiniScreenComp', () => ({
    default: () => <p>mini screen</p>,
}));

import AppPresenterRightComp from './AppPresenterRightComp';

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

describe('AppPresenterRightComp', () => {
    test('stacks the Bible and notes over the mini screen, 4 to 5', async () => {
        await act(async () => root.render(<AppPresenterRightComp />));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(state.props.flexSizeName).toBe('app-presenter-right');
        expect(state.props.isHorizontal).toBe(false);
        expect(state.props.flexSizeDefault).toEqual({
            v1: ['4'],
            v2: ['5'],
        });
        expect(
            state.props.dataInput.map((item: any) => [
                item.key,
                item.widgetKey,
                item.widgetIconName,
                item.className,
            ]),
        ).toEqual([
            ['v1', 'Bible and Notes', 'journal-bookmark', 'app-flex-item'],
            ['v2', 'Mini Screen', 'aspect-ratio', 'app-flex-item'],
        ]);
        expect(host.querySelector('[data-key="v1"]')!.textContent).toBe(
            'bible and notes',
        );
        expect(host.querySelector('[data-key="v2"]')!.textContent).toBe(
            'mini screen',
        );
    });
});
