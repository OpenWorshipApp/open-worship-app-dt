// @vitest-environment jsdom
// jsdom because the module resolves the pin button through `document`, and
// `appProvider` touches `document` at module scope.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    getSettingMock,
    setSettingMock,
    removeSettingMock,
    showSimpleToastMock,
    notifyElementHighlightMock,
} = vi.hoisted(() => ({
    appProviderMock: { isPagePresenter: true },
    getSettingMock: vi.fn<(key: string) => string | null>(() => null),
    setSettingMock: vi.fn(),
    removeSettingMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    notifyElementHighlightMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: notifyElementHighlightMock,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
    removeSetting: removeSettingMock,
}));

const DOCUMENT_1 = { filePath: '/docs/a1.ows' } as any;
const DOCUMENT_2 = { filePath: '/docs/a2.ows' } as any;

async function importFreshModule() {
    vi.resetModules();
    return await import('./varyAppDocumentLockHelpers');
}

function addPinElement(id: string) {
    const element = document.createElement('button');
    element.id = id;
    document.body.appendChild(element);
    return element;
}

describe('varyAppDocumentLockHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSettingMock.mockReturnValue(null);
        appProviderMock.isPagePresenter = true;
        document.body.innerHTML = '';
    });

    test('defaults to unpinned and reads the setting exactly once', async () => {
        const helpers = await importFreshModule();

        expect(helpers.checkIsVaryAppDocumentPinned()).toBe(false);
        helpers.checkIsVaryAppDocumentPinned();
        helpers.checkIsVaryAppDocumentPinned();

        // The whole point of the module-level cache: no setting file read per
        // call, and none at all during a render.
        expect(getSettingMock).toHaveBeenCalledTimes(1);
        expect(getSettingMock).toHaveBeenCalledWith(
            helpers.SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME,
        );
    });

    test('restores a pinned state from the setting', async () => {
        getSettingMock.mockReturnValue('true');
        const helpers = await importFreshModule();

        expect(helpers.checkIsVaryAppDocumentPinned()).toBe(true);
    });

    test('pinning writes, unpinning removes, and no-ops write nothing', async () => {
        const helpers = await importFreshModule();

        helpers.setIsVaryAppDocumentPinned(false);
        expect(setSettingMock).not.toHaveBeenCalled();
        expect(removeSettingMock).not.toHaveBeenCalled();

        helpers.setIsVaryAppDocumentPinned(true);
        expect(setSettingMock).toHaveBeenCalledWith(
            helpers.SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME,
            'true',
        );

        setSettingMock.mockClear();
        helpers.setIsVaryAppDocumentPinned(true);
        expect(setSettingMock).not.toHaveBeenCalled();

        helpers.forceUnpinVaryAppDocument();
        expect(removeSettingMock).toHaveBeenCalledWith(
            helpers.SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME,
        );

        removeSettingMock.mockClear();
        // Runs on every matching delete event and every start, so it must be
        // free when there is nothing to unpin.
        helpers.forceUnpinVaryAppDocument();
        expect(removeSettingMock).not.toHaveBeenCalled();
    });

    test('never force-unpins from outside the presenter page', async () => {
        getSettingMock.mockReturnValue('true');
        appProviderMock.isPagePresenter = false;
        const helpers = await importFreshModule();

        helpers.forceUnpinVaryAppDocument();

        // The editor window shares this store and boots with its own selection
        // resolve; it must not drop the presenter's pin.
        expect(removeSettingMock).not.toHaveBeenCalled();
        expect(helpers.checkIsVaryAppDocumentPinned()).toBe(true);
    });

    test('toggling flips the stored state', async () => {
        const helpers = await importFreshModule();

        helpers.toggleIsVaryAppDocumentPinned();
        expect(helpers.checkIsVaryAppDocumentPinned()).toBe(true);
        helpers.toggleIsVaryAppDocumentPinned();
        expect(helpers.checkIsVaryAppDocumentPinned()).toBe(false);
    });

    test('allows every switch while unpinned', async () => {
        const helpers = await importFreshModule();

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(DOCUMENT_1, DOCUMENT_2),
        ).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('refuses a switch while pinned and draws attention to the pin', async () => {
        const helpers = await importFreshModule();
        const element = addPinElement(helpers.VARY_APP_DOCUMENT_PIN_ELEMENT_ID);
        helpers.setIsVaryAppDocumentPinned(true);

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(DOCUMENT_1, DOCUMENT_2),
        ).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledTimes(1);
        expect(notifyElementHighlightMock).toHaveBeenCalledTimes(1);
        const [elementGetter, options] =
            notifyElementHighlightMock.mock.calls[0];
        expect((elementGetter as () => Element)()).toBe(element);
        expect(options).toEqual({ type: 'warning' });
    });

    test('allows a re-click of the pinned document itself', async () => {
        const helpers = await importFreshModule();
        addPinElement(helpers.VARY_APP_DOCUMENT_PIN_ELEMENT_ID);
        helpers.setIsVaryAppDocumentPinned(true);

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(DOCUMENT_1, {
                filePath: DOCUMENT_1.filePath,
            } as any),
        ).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('allows a switch when nothing is previewed', async () => {
        const helpers = await importFreshModule();
        helpers.setIsVaryAppDocumentPinned(true);

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(null, DOCUMENT_2),
        ).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('never refuses outside the presenter page', async () => {
        appProviderMock.isPagePresenter = false;
        getSettingMock.mockReturnValue('true');
        const helpers = await importFreshModule();

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(DOCUMENT_1, DOCUMENT_2),
        ).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('still toasts but never polls when the pin is not mounted', async () => {
        const helpers = await importFreshModule();
        helpers.setIsVaryAppDocumentPinned(true);

        expect(
            helpers.checkIsVaryAppDocumentSwitchRefused(DOCUMENT_1, DOCUMENT_2),
        ).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledTimes(1);
        // `notifyElementHighlight` retries a null getter for ~3s, so a window
        // without the pin must never reach it.
        expect(notifyElementHighlightMock).not.toHaveBeenCalled();
    });
});

describe('useIsVaryAppDocumentPinned', () => {
    type HelpersType = Awaited<ReturnType<typeof importFreshModule>>;

    const unmounts: Array<() => void> = [];

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        getSettingMock.mockReturnValue(null);
        appProviderMock.isPagePresenter = true;
        document.body.innerHTML = '';
    });

    afterEach(() => {
        while (unmounts.length > 0) {
            unmounts.pop()?.();
        }
        delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    });

    // Imported after `importFreshModule`, so the probe and the store it reads
    // share one React whatever the registry reset reaches.
    async function mountPinProbe(helpers: HelpersType) {
        const React = await import('react');
        const { createRoot } = await import('react-dom/client');
        const renders: boolean[] = [];
        function PinProbeComp() {
            const isPinned = helpers.useIsVaryAppDocumentPinned();
            renders.push(isPinned);
            return React.createElement(
                'span',
                null,
                isPinned ? 'pinned' : 'free',
            );
        }
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        React.act(() => {
            root.render(React.createElement(PinProbeComp));
        });
        let isMounted = true;
        const unmount = () => {
            if (!isMounted) {
                return;
            }
            isMounted = false;
            React.act(() => {
                root.unmount();
            });
            container.remove();
        };
        unmounts.push(unmount);
        return { act: React.act, container, renders, unmount };
    }

    test('a pin button opens on the stored state and redraws on every change', async () => {
        getSettingMock.mockReturnValue('true');
        const helpers = await importFreshModule();
        const probe = await mountPinProbe(helpers);
        expect(probe.container.textContent).toBe('pinned');

        probe.act(() => {
            helpers.toggleIsVaryAppDocumentPinned();
        });
        expect(probe.container.textContent).toBe('free');
        probe.act(() => {
            helpers.setIsVaryAppDocumentPinned(true);
        });
        expect(probe.container.textContent).toBe('pinned');
        // The delete event's unpin reaches the button too, or it would go on
        // showing a pin that no longer refuses anything.
        probe.act(() => {
            helpers.forceUnpinVaryAppDocument();
        });
        expect(probe.container.textContent).toBe('free');
        expect(probe.renders).toEqual([true, false, true, false]);
        // Read once for the button's whole life, not once per render.
        expect(getSettingMock).toHaveBeenCalledTimes(1);
    });

    test('a pin button left mounted still follows after another one unmounts', async () => {
        const helpers = await importFreshModule();
        const leaving = await mountPinProbe(helpers);
        const staying = await mountPinProbe(helpers);
        leaving.unmount();

        staying.act(() => {
            helpers.setIsVaryAppDocumentPinned(true);
        });
        expect(staying.container.textContent).toBe('pinned');
        expect(staying.renders).toEqual([false, true]);
        expect(leaving.renders).toEqual([false]);
    });
});
