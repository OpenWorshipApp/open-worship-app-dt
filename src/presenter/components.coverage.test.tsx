// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    restore: vi.fn(),
    handleError: vi.fn(),
    takeOver: vi.fn(),
    applyTarget: vi.fn(),
    controllers: [] as Array<{
        settingNameSuffix: string;
        finalRenderer: ((bibleItem: { id: string }) => ReactElement) | null;
    }>,
    contextValues: [] as unknown[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../keyboard-shortcut/keyingAreaHelpers', () => ({
    useKeyingAreaTakeOver: h.takeOver,
}));
// Distinct values, so a pane given another pane's setting is caught.
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: {
        appPresenter: 'setting:appPresenter',
        appPresenterLeft: 'setting:appPresenterLeft',
        appPresenterMiddle: 'setting:appPresenterMiddle',
        appPresenterRight: 'setting:appPresenterRight',
    },
}));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (labelKey: string) => ({
        widgetName: `name:${labelKey}`,
        widgetKey: labelKey,
    }),
}));
// Each pane as a section, its lazy body loaded the way the real actor does.
vi.mock('../resize-actor/ResizeActorComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: (props: any) => (
            <div
                className="test-resize"
                data-flex-size-name={props.flexSizeName}
                data-horizontal={String(props.isHorizontal)}
                data-defaults={JSON.stringify(props.flexSizeDefault)}
            >
                {props.dataInput.map((item: any) => {
                    const Child = item.children;
                    return (
                        <section
                            key={item.key}
                            data-key={item.key}
                            data-widget-key={item.widgetKey}
                            data-widget-name={item.widgetName}
                            data-class-name={item.className ?? ''}
                        >
                            <Suspense fallback={<i>loading</i>}>
                                <Child />
                            </Suspense>
                        </section>
                    );
                })}
            </div>
        ),
    };
});
vi.mock('../app-document-list/VaryAppDocumentListComp', () => ({
    default: () => <p>Document list body</p>,
}));
vi.mock('../presenting-flow/PresentingFlowListComp', () => ({
    default: () => <p>Presenting flow body</p>,
}));
vi.mock('../app-document-presenter/PresenterComp', () => ({
    default: () => <p>Presenter body</p>,
}));
vi.mock('../background/BackgroundComp', () => ({
    default: () => <p>Background body</p>,
}));
vi.mock('../bible-list/BibleReadingLeftComp', () => ({
    default: () => <p>Bible and notes body</p>,
}));
vi.mock('../_screen/preview/MiniScreenComp', () => ({
    default: () => <p>Mini screen body</p>,
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    restoreVirtualDisplayScreens: h.restore,
}));
vi.mock('../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    class FakeBibleItemsViewController {
        settingNameSuffix: string;
        finalRenderer: ((bibleItem: { id: string }) => ReactElement) | null =
            null;
        applyTargetOrBibleKey = (...args: unknown[]) => h.applyTarget(...args);
        constructor(settingNameSuffix: string) {
            this.settingNameSuffix = settingNameSuffix;
            h.controllers.push(this);
        }
    }
    return {
        default: FakeBibleItemsViewController,
        BibleItemsViewControllerContext: createContext<unknown>(null),
    };
});
vi.mock('../bible-reader/view-extra/viewExtraHelpers', async () => {
    const { createContext } = await import('react');
    return {
        BibleViewTitleMaterialContext: createContext<{
            titleElement: ReactElement;
        } | null>(null),
    };
});
vi.mock('../bible-reader/view-extra/BibleViewTitleEditingComp', () => ({
    BibleViewTitleEditingComp: (props: any) => (
        <button
            type="button"
            onClick={() => props.onTargetChange({ chapter: 3 })}
        >{`Edit title of ${props.bibleItem.id}`}</button>
    ),
}));
vi.mock('../bible-reader/BibleViewComp', async () => {
    const { use } = await import('react');
    const { BibleViewTitleMaterialContext } =
        await import('../bible-reader/view-extra/viewExtraHelpers');
    return {
        default: (props: any) => {
            const material = use(BibleViewTitleMaterialContext);
            return (
                <article data-bible-id={props.bibleItem.id}>
                    {material?.titleElement}
                </article>
            );
        },
    };
});
vi.mock('../screen-setting/BibleCustomStyleFloatingComp', async () => {
    const { use } = await import('react');
    const { BibleItemsViewControllerContext } =
        await import('../bible-reader/BibleItemsViewController');
    return {
        default: () => {
            h.contextValues.push(use(BibleItemsViewControllerContext));
            return <aside>Bible style floating</aside>;
        },
    };
});
vi.mock('../setting/data-archive/DataArchiveAppMenuComp', () => ({
    default: () => <aside>Data archive menu</aside>,
}));
vi.mock('../lang/LangAppMenuComp', () => ({
    default: () => <aside>Language menu</aside>,
}));

import AppPresenterComp from './AppPresenterComp';

let container: HTMLDivElement;
let root: Root;

const BODY_TEXTS = [
    'Document list body',
    'Presenting flow body',
    'Presenter body',
    'Background body',
    'Bible and notes body',
    'Mini screen body',
];

async function waitFor(check: () => boolean, what: string) {
    for (let turn = 0; turn < 300; turn++) {
        if (check()) {
            return;
        }
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
        });
    }
    throw new Error(`Timed out waiting for ${what}`);
}

async function renderPresenter() {
    await act(async () => root.render(<AppPresenterComp />));
    await waitFor(() => {
        return BODY_TEXTS.every((text) => {
            return container.textContent?.includes(text);
        });
    }, 'every lazy pane');
}

function describePane(element: Element) {
    const resize = element as HTMLElement;
    const sections = Array.from(
        resize.querySelectorAll<HTMLElement>(':scope > section'),
    );
    return {
        flexSizeName: resize.dataset.flexSizeName,
        isHorizontal: resize.dataset.horizontal,
        defaults: JSON.parse(resize.dataset.defaults!),
        keys: sections.map((section) => section.dataset.key),
        widgetKeys: sections.map((section) => section.dataset.widgetKey),
        widgetNames: sections.map((section) => section.dataset.widgetName),
        classNames: sections.map((section) => section.dataset.className),
        sections,
    };
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.controllers.length = 0;
    h.contextValues.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('AppPresenterComp', () => {
    test('three columns, each loading its own pair of panes', async () => {
        await renderPresenter();
        const outer = describePane(container.querySelector('.test-resize')!);
        expect(outer).toMatchObject({
            flexSizeName: 'setting:appPresenter',
            isHorizontal: 'true',
            defaults: { h1: ['1'], h2: ['3'], h3: ['2'] },
            keys: ['h1', 'h2', 'h3'],
            widgetKeys: [
                'App Presenter Left',
                'App Presenter Middle',
                'App Presenter Right',
            ],
            widgetNames: [
                'name:App Presenter Left',
                'name:App Presenter Middle',
                'name:App Presenter Right',
            ],
        });
        const [leftSection, middleSection, rightSection] = outer.sections;

        const left = describePane(leftSection.querySelector('.test-resize')!);
        expect(left).toMatchObject({
            flexSizeName: 'setting:appPresenterLeft',
            isHorizontal: 'false',
            defaults: { v1: ['3'], v2: ['2'] },
            keys: ['v1', 'v2'],
            widgetKeys: ['Document List', 'Presenting Flow List'],
            classNames: ['app-flex-item', 'app-flex-item'],
        });
        expect(left.sections[0].textContent).toBe('Document list body');
        expect(left.sections[1].textContent).toBe('Presenting flow body');

        const middle = describePane(
            middleSection.querySelector('.test-resize')!,
        );
        expect(middle).toMatchObject({
            flexSizeName: 'setting:appPresenterMiddle',
            isHorizontal: 'false',
            defaults: { v1: ['3'], v2: ['1'] },
            widgetKeys: ['Presenter', 'Background'],
            classNames: ['app-flex-item', 'app-flex-item'],
        });
        expect(middle.sections[0].textContent).toBe('Presenter body');
        expect(middle.sections[1].textContent).toBe('Background body');

        const right = describePane(rightSection.querySelector('.test-resize')!);
        expect(right).toMatchObject({
            flexSizeName: 'setting:appPresenterRight',
            isHorizontal: 'false',
            defaults: { v1: ['4'], v2: ['5'] },
            widgetKeys: ['Bible and Notes', 'Mini Screen'],
            classNames: ['app-flex-item', 'app-flex-item'],
        });
        expect(right.sections[0].textContent).toBe('Bible and notes body');
        expect(right.sections[1].textContent).toBe('Mini screen body');

        // The page's own menus and the floating Bible style ride along.
        expect(container.textContent).toContain('Data archive menu');
        expect(container.textContent).toContain('Language menu');
        expect(container.textContent).toContain('Bible style floating');
    });

    test('takes over the keys and brings the virtual-display screens back', async () => {
        await renderPresenter();
        expect(h.takeOver).toHaveBeenCalled();
        await waitFor(() => h.restore.mock.calls.length > 0, 'the restore');
        expect(h.restore).toHaveBeenCalledTimes(1);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a restore that fails is handled, not thrown', async () => {
        const error = new Error('no virtual display');
        h.restore.mockImplementation(() => {
            throw error;
        });
        await renderPresenter();
        await waitFor(() => h.handleError.mock.calls.length > 0, 'the error');
        expect(h.handleError).toHaveBeenCalledWith(error);
    });

    test('one presenter Bible controller, whose views carry an editable title', async () => {
        await renderPresenter();
        expect(h.controllers).toHaveLength(1);
        const [controller] = h.controllers;
        expect(controller.settingNameSuffix).toBe('presenter');
        // The same controller is what the page's context hands out.
        expect(h.contextValues.length).toBeGreaterThan(0);
        expect(
            h.contextValues.every((value) => {
                return value === controller;
            }),
        ).toBe(true);

        const bibleItem = { id: 'bible-item-1' };
        const viewHost = document.createElement('div');
        document.body.appendChild(viewHost);
        const viewRoot = createRoot(viewHost);
        try {
            act(() => viewRoot.render(controller.finalRenderer!(bibleItem)));
            const view = viewHost.querySelector('article')!;
            expect(view.dataset.bibleId).toBe('bible-item-1');
            const title = view.querySelector('button')!;
            expect(title.textContent).toBe('Edit title of bible-item-1');
            act(() => title.click());
            expect(h.applyTarget).toHaveBeenCalledWith(bibleItem, {
                target: { chapter: 3 },
            });
        } finally {
            act(() => viewRoot.unmount());
            viewHost.remove();
        }
    });
});
