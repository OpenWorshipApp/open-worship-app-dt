// @vitest-environment jsdom

// The actions on a Bible XML row that BibleXMLInfoComp.test.tsx does not
// press: the editor toggle and its unsaved-changes guard, Reset (KJV only),
// Move to Trash and the row's context menu.

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settingKeys: [] as string[],
    handBibleKeyContextMenuOpeningMock: vi.fn(),
    deleteBibleXMLMock: vi.fn(),
    resetBibleXMLToEmbeddedKJVMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    warnIfBibleKeyDirtyMock: vi.fn(),
    forceReloadAppWindowsMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('./bibleXMLHelpers', () => ({
    handBibleKeyContextMenuOpening: h.handBibleKeyContextMenuOpeningMock,
    deleteBibleXML: h.deleteBibleXMLMock,
    resetBibleXMLToEmbeddedKJV: h.resetBibleXMLToEmbeddedKJVMock,
    useBibleXMLInfo: () => ({ bibleInfo: { title: 'King James Version' } }),
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
}));
vi.mock('../../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingBoolean: (key: string, defaultValue: boolean) => {
            h.settingKeys.push(key);
            return react.useState(defaultValue);
        },
    };
});
vi.mock('../../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => (
        <Suspense fallback={null}>{children}</Suspense>
    ),
}));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./bibleEditorDirtyHelpers', () => ({
    warnIfBibleKeyDirty: h.warnIfBibleKeyDirtyMock,
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../settingHelpers', () => ({
    forceReloadAppWindows: h.forceReloadAppWindowsMock,
}));
vi.mock('./BibleXMLDataPreviewComp', () => ({
    default: ({ bibleKey }: { bibleKey: string }) => (
        <div data-testid="data-preview">{bibleKey}</div>
    ),
}));

import BibleXMLInfoComp from './BibleXMLInfoComp';

let container: HTMLDivElement;
let root: Root;

function getButton(label: string) {
    return container.querySelector(
        `button[aria-label="${label}"]`,
    ) as HTMLButtonElement | null;
}

function getPreview() {
    return container.querySelector('[data-testid="data-preview"]');
}

async function flushLazy() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderRow(bibleKey = 'KJV') {
    const loadBibleKeys = vi.fn();
    await act(async () => {
        root.render(
            <BibleXMLInfoComp
                bibleKey={bibleKey}
                loadBibleKeys={loadBibleKeys}
                filePath={`/bibles/${bibleKey}.xml`}
            />,
        );
    });
    return loadBibleKeys;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settingKeys = [];
    h.warnIfBibleKeyDirtyMock.mockReturnValue(false);
    h.showAppConfirmMock.mockResolvedValue(true);
    h.resetBibleXMLToEmbeddedKJVMock.mockResolvedValue(true);
    h.deleteBibleXMLMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BibleXMLInfoComp editor toggle', () => {
    test('opens the data editor, remembered per Bible, and closes it again', async () => {
        await renderRow('KSV');
        expect(h.settingKeys).toContain('bible-xml-KSV');
        const toggle = getButton('Show Editor')!;
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(getPreview()).toBeNull();

        await act(async () => toggle.click());
        await flushLazy();

        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.title).toBe('Hide Editor');
        expect(getPreview()!.textContent).toBe('KSV');
        // Opening asks nothing: there is nothing to lose yet.
        expect(h.warnIfBibleKeyDirtyMock).not.toHaveBeenCalled();

        await act(async () => toggle.click());

        expect(h.warnIfBibleKeyDirtyMock).toHaveBeenCalledWith(
            'KSV',
            'Save or discard unsaved Bible changes before closing the editor.',
        );
        expect(getPreview()).toBeNull();
    });

    test('stays open while its editor holds unsaved changes', async () => {
        await renderRow('KSV');
        const toggle = getButton('Show Editor')!;
        await act(async () => toggle.click());
        await flushLazy();
        h.warnIfBibleKeyDirtyMock.mockReturnValue(true);

        await act(async () => toggle.click());

        expect(getPreview()).not.toBeNull();
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
    });
});

describe('BibleXMLInfoComp Reset', () => {
    test('is offered on the KJV row only', async () => {
        await renderRow('KSV');
        expect(getButton('Reset Bible XML')).toBeNull();
        await renderRow('KJV');
        expect(getButton('Reset Bible XML')).not.toBeNull();
    });

    test('replaces the file with the embedded KJV once confirmed, then reloads', async () => {
        const loadBibleKeys = await renderRow('KJV');

        await act(async () => getButton('Reset Bible XML')!.click());

        expect(h.showAppConfirmMock).toHaveBeenCalledWith(
            'Reset Bible XML',
            'Reset this bible XML with the app embedded KJV? ' +
                'All your changes will be lost.',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(h.resetBibleXMLToEmbeddedKJVMock).toHaveBeenCalledWith(
            '/bibles/KJV.xml',
        );
        expect(loadBibleKeys).toHaveBeenCalledOnce();
        expect(h.forceReloadAppWindowsMock).toHaveBeenCalledOnce();
    });

    test('a refused, unconfirmed or failed reset changes nothing', async () => {
        const loadBibleKeys = await renderRow('KJV');

        h.warnIfBibleKeyDirtyMock.mockReturnValueOnce(true);
        await act(async () => getButton('Reset Bible XML')!.click());
        expect(h.warnIfBibleKeyDirtyMock).toHaveBeenCalledWith(
            'KJV',
            'Save or discard unsaved Bible changes before resetting.',
        );
        expect(h.showAppConfirmMock).not.toHaveBeenCalled();

        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await act(async () => getButton('Reset Bible XML')!.click());
        expect(h.resetBibleXMLToEmbeddedKJVMock).not.toHaveBeenCalled();

        h.resetBibleXMLToEmbeddedKJVMock.mockResolvedValueOnce(false);
        await act(async () => getButton('Reset Bible XML')!.click());
        expect(h.resetBibleXMLToEmbeddedKJVMock).toHaveBeenCalledOnce();

        expect(loadBibleKeys).not.toHaveBeenCalled();
        expect(h.forceReloadAppWindowsMock).not.toHaveBeenCalled();
    });

    test('the press stops at its button, as does Move to Trash', async () => {
        const onParentClick = vi.fn();
        await act(async () => {
            root.render(
                <div onClick={onParentClick}>
                    <BibleXMLInfoComp
                        bibleKey="KJV"
                        loadBibleKeys={vi.fn()}
                        filePath="/bibles/KJV.xml"
                    />
                </div>,
            );
        });

        await act(async () => getButton('Reset Bible XML')!.click());
        await act(async () => getButton('Move to Trash')!.click());
        expect(onParentClick).not.toHaveBeenCalled();

        // The editor toggle is not stopped: only the two that act on the file.
        await act(async () => getButton('Show Editor')!.click());
        expect(onParentClick).toHaveBeenCalledOnce();
    });
});

describe('BibleXMLInfoComp Move to Trash', () => {
    test('trashes the Bible XML once confirmed and reloads the list', async () => {
        const loadBibleKeys = await renderRow('KSV');

        await act(async () => getButton('Move to Trash')!.click());

        expect(h.showAppConfirmMock).toHaveBeenCalledWith(
            'Delete Bible XML',
            'Are you sure to delete bible XML "KSV"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(h.deleteBibleXMLMock).toHaveBeenCalledWith('KSV');
        expect(loadBibleKeys).toHaveBeenCalledOnce();
    });

    test('a "No" keeps the file', async () => {
        h.showAppConfirmMock.mockResolvedValue(false);
        const loadBibleKeys = await renderRow('KSV');

        await act(async () => getButton('Move to Trash')!.click());

        expect(h.deleteBibleXMLMock).not.toHaveBeenCalled();
        expect(loadBibleKeys).not.toHaveBeenCalled();
    });
});

test('the row opens its context menu for its own key', async () => {
    await renderRow('KSV');
    const row = container.querySelector('li')!;
    expect(row.title).toBe('King James Version /bibles/KSV.xml');

    await act(async () => {
        row.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });

    expect(h.handBibleKeyContextMenuOpeningMock).toHaveBeenCalledOnce();
    expect(h.handBibleKeyContextMenuOpeningMock.mock.calls[0][0]).toBe('KSV');
});
