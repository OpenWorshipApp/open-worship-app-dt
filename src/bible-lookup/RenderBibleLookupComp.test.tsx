// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    controller: {} as any,
    getBibleInfo: vi.fn(),
    migrate: vi.fn(),
    getSetting: vi.fn(),
    getFlex: vi.fn(),
    entries: [] as Array<{ id: string; isHidden: boolean }>,
    widgetListeners: new Set<() => void>(),
    bibleListeners: new Set<() => void>(),
    toggleWidget: vi.fn(),
    unsubscribeWidget: vi.fn(),
    unregisterBible: vi.fn(),
    resizeProps: null as any,
    contexts: null as any,
    hidePopup: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../bible-reader/LookupBibleItemController', async () => {
    const react = await import('react');
    return {
        EditingResultContext: react.createContext(null),
        useLookupBibleItemControllerContext: () => h.controller,
    };
});
vi.mock('../bible-list/bibleHelpers', async () => {
    const react = await import('react');
    return { SelectedBibleKeyContext: react.createContext('') };
});
vi.mock('./InputHandlerComp', async () => {
    const react = await import('react');
    return { InputTextContext: react.createContext({ inputText: '' }) };
});
vi.mock('../helper/MultiContextRenderComp', () => ({
    MultiContextRenderComp: ({
        contexts,
        children,
    }: {
        contexts: unknown;
        children: unknown;
    }) => {
        h.contexts = contexts;
        return children;
    },
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeProps = props;
        const lookup = props.dataInput.find((item: any) => item.key === 'h2');
        return createElement('div', {}, lookup.children.render());
    },
}));
vi.mock('./BibleLookupBodyPreviewerComp', () => ({
    default: () => createElement('div', {}, 'Bible body'),
}));
vi.mock('./RenderLookupSuggestionComp', () => ({
    BibleNotAvailableComp: ({ bibleKey }: { bibleKey: string }) =>
        createElement('div', {}, `Unavailable: ${bibleKey}`),
}));
vi.mock('./RenderBibleLookupHeaderComp', () => ({
    default: ({ toggleAdvanceLookup }: { toggleAdvanceLookup: () => void }) =>
        createElement(
            'button',
            { type: 'button', onClick: toggleAdvanceLookup },
            'Lookup header',
        ),
}));
vi.mock('./RenderExtraButtonsRightComp', () => ({
    default: () => createElement('div', {}, 'Fallback header'),
}));
vi.mock('../app-modal/ModalComp', () => ({
    ModalCloseButtonComp: ({ close }: { close: () => void }) =>
        createElement('button', { onClick: close }, 'Close lookup'),
}));
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.hidePopup,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => createElement('div', {}, 'Loading Bible'),
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfo,
}));
vi.mock('../helper/bible-helpers/bibleListChangeHelpers', () => ({
    registerBibleListChangedListener: (listener: () => void) => {
        h.bibleListeners.add(listener);
        return () => {
            h.bibleListeners.delete(listener);
            h.unregisterBible();
        };
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSetting,
}));
vi.mock('../server/appProvider', () => ({
    default: { currentHomePage: 'presenter/index' },
}));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (label: string) => ({ label }),
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    getFlexSizeSetting: h.getFlex,
}));
vi.mock('../resize-actor/widgetRegistry', () => ({
    getWidgetEntries: () => h.entries,
    subscribeWidgetsChanged: (listener: () => void) => {
        h.widgetListeners.add(listener);
        return () => {
            h.widgetListeners.delete(listener);
            h.unsubscribeWidget();
        };
    },
    toggleWidget: h.toggleWidget,
    toWidgetId: (name: string, key: string) => `${name}:${key}`,
}));
vi.mock('./lookupLayoutHelpers', () => ({
    ADVANCE_LOOKUP_WIDGET_KEY: 'advance',
    genLookupFlexSizeDefault: (hasLeading: boolean) => ({
        leading: hasLeading,
    }),
    migrateLookupLayout: h.migrate,
}));

import RenderBibleLookupComp from './RenderBibleLookupComp';

let root: Root;
let container: HTMLDivElement;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

async function render(leadingWidgets?: any[]) {
    await act(async () =>
        root.render(
            createElement(RenderBibleLookupComp, {
                leadingWidgets,
            }),
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.getBibleInfo.mockReset().mockResolvedValue({ title: 'English' });
    h.getSetting.mockReset().mockReturnValue(null);
    h.getFlex.mockReset().mockReturnValue({ advance: [1, true] });
    h.migrate.mockClear();
    h.entries = [{ id: 'bible-lookup-container-body:advance', isHidden: true }];
    h.widgetListeners.clear();
    h.bibleListeners.clear();
    h.toggleWidget.mockReset().mockImplementation((id: string) => {
        const entry = h.entries.find((item) => item.id === id)!;
        entry.isHidden = !entry.isHidden;
        for (const listener of h.widgetListeners) listener();
    });
    h.unsubscribeWidget.mockClear();
    h.unregisterBible.mockClear();
    h.resizeProps = null;
    h.contexts = null;
    h.controller = {
        selectedBibleItem: { bibleKey: 'en' },
        inputText: '',
        getEditingResult: vi.fn().mockResolvedValue({ text: 'initial' }),
        settleEditingResult: vi.fn(),
        setInputText: undefined,
        reloadEditingResult: undefined,
        setBibleKey: undefined,
        setIsAdvanceLookupOpened: undefined,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Bible lookup container', () => {
    it('renders the available Bible and wires layout visibility to the controller', async () => {
        await render();
        expect(container.textContent).toContain('Bible body');
        expect(container.textContent).toContain('Lookup header');
        expect(h.migrate).toHaveBeenCalledWith(
            'bible-lookup-container-body',
            false,
            false,
        );
        expect(
            h.resizeProps.dataInput.map((item: { key: string }) => item.key),
        ).toEqual(['h2', 'advance']);
        expect(
            h.contexts.map((item: { value: unknown }) => item.value)[0],
        ).toBe('en');
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(h.entries[0].isHidden).toBe(false);
        await act(async () => h.controller.setIsAdvanceLookupOpened(false));
        expect(h.entries[0].isHidden).toBe(true);
    });

    it('settles only the newest asynchronous editing result', async () => {
        await render();
        const older = deferred<{ text: string }>();
        const newer = deferred<{ text: string }>();
        h.controller.getEditingResult
            .mockReturnValueOnce(older.promise)
            .mockReturnValueOnce(newer.promise);
        await act(async () => {
            await h.controller.setInputText('Psal');
            await h.controller.setInputText('Psalm 23:1');
        });
        await act(async () => newer.resolve({ text: 'Psalm 23:1' }));
        expect(h.controller.settleEditingResult).toHaveBeenCalledTimes(1);
        expect(h.controller.settleEditingResult).toHaveBeenCalledWith({
            text: 'Psalm 23:1',
        });
        await act(async () => older.resolve({ text: 'Psal' }));
        expect(h.controller.settleEditingResult).toHaveBeenCalledTimes(1);
        expect(
            h.contexts.map((item: { value: unknown }) => item.value)[1],
        ).toEqual({
            inputText: 'Psalm 23:1',
        });
    });

    it('rechecks a missing Bible and replaces the unavailable state when it arrives', async () => {
        h.getBibleInfo.mockResolvedValueOnce(null).mockResolvedValueOnce({
            title: 'Installed',
        });
        await render();
        expect(container.textContent).toContain('Unavailable: en');
        expect(container.textContent).toContain('Fallback header');
        // The only way out of the popup (its ✕ is also what owns Ctrl+Q)
        // must be there when the lookup's Bible is not installed too.
        const closeButton = Array.from(
            container.querySelectorAll('button'),
        ).find((button) => button.textContent === 'Close lookup');
        expect(closeButton).toBeDefined();
        await act(async () => closeButton!.click());
        expect(h.hidePopup).toHaveBeenCalledOnce();
        expect(h.bibleListeners.size).toBe(1);
        await act(async () => {
            for (const listener of h.bibleListeners) await listener();
        });
        expect(container.textContent).toContain('Bible body');
        expect(h.getBibleInfo).toHaveBeenLastCalledWith('en', true);
        expect(h.unregisterBible).toHaveBeenCalledTimes(1);
    });

    it('updates Bible selection and releases controller callbacks on unmount', async () => {
        await render();
        await act(async () => h.controller.setBibleKey('fr'));
        expect(h.getBibleInfo).toHaveBeenLastCalledWith('fr');
        expect(
            h.contexts.map((item: { value: unknown }) => item.value)[0],
        ).toBe('fr');
        const liveSetInputText = h.controller.setInputText;
        const liveReload = h.controller.reloadEditingResult;
        const liveSetBibleKey = h.controller.setBibleKey;
        await act(async () => root.unmount());
        expect(h.unsubscribeWidget).toHaveBeenCalledTimes(1);
        expect(h.controller.setInputText).not.toBe(liveSetInputText);
        expect(h.controller.reloadEditingResult).not.toBe(liveReload);
        expect(h.controller.setBibleKey).not.toBe(liveSetBibleKey);
        root = createRoot(container);
    });
});
