// @vitest-environment jsdom
// jsdom because the module resolves the pin button through `document`, and
// `appProvider` touches `document` at module scope.

import { beforeEach, describe, expect, test, vi } from 'vitest';

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
