// @vitest-environment jsdom

import {
    act,
    Suspense,
    use,
    type ComponentType,
    type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    resizeProps: null as any,
    controllers: [] as any[],
    restoreVirtualDisplayScreens: vi.fn(),
    useKeyingAreaTakeOver: vi.fn(),
    handleError: vi.fn(),
    columnController: undefined as unknown,
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: state.handleError }));
vi.mock('../keyboard-shortcut/keyingAreaHelpers', () => ({
    useKeyingAreaTakeOver: state.useKeyingAreaTakeOver,
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { appPresenter: 'app-presenter-main' },
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        state.resizeProps = props;
        return (
            <div className="resize-actor">
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
vi.mock('../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    class FakeBibleItemsViewController {
        settingNameSuffix: string;
        finalRenderer: ((bibleItem: any) => ReactElement) | null = null;
        applyTargetOrBibleKey = vi.fn();
        constructor(settingNameSuffix: string) {
            this.settingNameSuffix = settingNameSuffix;
            state.controllers.push(this);
        }
    }
    return {
        default: FakeBibleItemsViewController,
        BibleItemsViewControllerContext: createContext<any>(null),
    };
});
vi.mock('../bible-reader/view-extra/viewExtraHelpers', async () => {
    const { createContext } = await import('react');
    return { BibleViewTitleMaterialContext: createContext<any>(null) };
});
vi.mock('../bible-reader/BibleViewComp', async () => {
    const { BibleViewTitleMaterialContext } =
        await import('../bible-reader/view-extra/viewExtraHelpers');
    return {
        default: ({ bibleItem }: { bibleItem: { target: string } }) => {
            const material = use(BibleViewTitleMaterialContext);
            return (
                <article data-target={bibleItem.target}>
                    {material?.titleElement}
                </article>
            );
        },
    };
});
vi.mock('../bible-reader/view-extra/BibleViewTitleEditingComp', () => ({
    BibleViewTitleEditingComp: ({
        bibleItem,
        onTargetChange,
    }: {
        bibleItem: { target: string };
        onTargetChange: (target: string) => void;
    }) => (
        <button
            type="button"
            className="title-editing"
            onClick={() => onTargetChange(`${bibleItem.target}-changed`)}
        >
            {bibleItem.target}
        </button>
    ),
}));
vi.mock('../screen-setting/BibleCustomStyleFloatingComp', () => ({
    default: () => <i data-part="bible-style-floating" />,
}));
vi.mock('../setting/data-archive/DataArchiveAppMenuComp', () => ({
    default: () => <i data-part="data-archive-menu" />,
}));
vi.mock('../lang/LangAppMenuComp', () => ({
    default: () => <i data-part="lang-menu" />,
}));
// The left column reads the view controller the way the real columns do.
vi.mock('./AppPresenterLeftComp', async () => {
    const { BibleItemsViewControllerContext } =
        await import('../bible-reader/BibleItemsViewController');
    return {
        default: () => {
            state.columnController = use(BibleItemsViewControllerContext);
            return <p>left</p>;
        },
    };
});
vi.mock('./AppPresenterMiddleComp', () => ({ default: () => <p>middle</p> }));
vi.mock('./AppPresenterRightComp', () => ({ default: () => <p>right</p> }));
vi.mock('../_screen/preview/MiniScreenComp', () => ({ default: () => null }));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    restoreVirtualDisplayScreens: state.restoreVirtualDisplayScreens,
}));

import AppPresenterComp from './AppPresenterComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.resizeProps = null;
    state.controllers = [];
    state.columnController = undefined;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('AppPresenterComp', () => {
    test('lays out the three presenter columns, 1 : 3 : 2', async () => {
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.resizeProps.flexSizeName).toBe('app-presenter-main');
        expect(state.resizeProps.isHorizontal).toBe(true);
        expect(state.resizeProps.flexSizeDefault).toEqual({
            h1: ['1'],
            h2: ['3'],
            h3: ['2'],
        });
        expect(
            state.resizeProps.dataInput.map((item: any) => [
                item.key,
                item.widgetKey,
                item.widgetIconName,
            ]),
        ).toEqual([
            ['h1', 'App Presenter Left', 'layout-sidebar'],
            ['h2', 'App Presenter Middle', 'layout-split'],
            ['h3', 'App Presenter Right', 'layout-sidebar-reverse'],
        ]);
        expect(
            Array.from(host.querySelectorAll('section')).map(
                (section) => section.textContent,
            ),
        ).toEqual(['left', 'middle', 'right']);
        expect(
            Array.from(host.querySelectorAll('[data-part]')).map((element) =>
                element.getAttribute('data-part'),
            ),
        ).toEqual(['bible-style-floating', 'data-archive-menu', 'lang-menu']);
        expect(state.useKeyingAreaTakeOver).toHaveBeenCalled();
    });

    test('brings back the virtual-display screens once the mini screen is loaded', async () => {
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.restoreVirtualDisplayScreens).toHaveBeenCalledOnce();
        expect(state.handleError).not.toHaveBeenCalled();
        // Re-rendering does not restore them again.
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.restoreVirtualDisplayScreens).toHaveBeenCalledOnce();
    });

    test('a failed restore is reported, not thrown', async () => {
        state.restoreVirtualDisplayScreens.mockImplementationOnce(() => {
            throw new Error('display gone');
        });
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.handleError).toHaveBeenCalledOnce();
        expect(state.handleError.mock.calls[0][0].message).toBe('display gone');
    });

    test('one presenter view controller is shared with the columns', async () => {
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.controllers).toHaveLength(1);
        expect(state.controllers[0].settingNameSuffix).toBe('presenter');
        expect(state.columnController).toBe(state.controllers[0]);
        // Re-rendering keeps the same controller.
        await act(async () => root.render(<AppPresenterComp />));
        await flush();
        expect(state.controllers).toHaveLength(1);
        expect(state.columnController).toBe(state.controllers[0]);
    });

    test('each bible view gets an editable title that retargets it', async () => {
        await act(async () => root.render(<AppPresenterComp />));
        const controller = state.controllers[0];
        const bibleItem = { target: 'JHN 3:16' };
        const element = controller.finalRenderer(bibleItem);
        const viewHost = document.createElement('div');
        const viewRoot = createRoot(viewHost);
        await act(async () => viewRoot.render(element));
        const view = viewHost.querySelector('article')!;
        expect(view.dataset.target).toBe('JHN 3:16');
        const title = view.querySelector<HTMLButtonElement>('.title-editing')!;
        expect(title.textContent).toBe('JHN 3:16');
        await act(async () => title.click());
        expect(
            controller.applyTargetOrBibleKey,
        ).toHaveBeenCalledExactlyOnceWith(bibleItem, {
            target: 'JHN 3:16-changed',
        });
        await act(async () => viewRoot.unmount());
    });
});
