// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One row of the Bible XML list: opening its editor, resetting the KJV and
// moving a Bible to the trash.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        info: { title: 'King James' } as Record<string, unknown> | null,
        isDirty: false,
    },
    mocks: {
        contextMenu: vi.fn(),
        deleteXML: vi.fn(),
        resetKJV: vi.fn(),
        confirm: vi.fn(),
        warnDirty: vi.fn(),
        reload: vi.fn(),
        loadBibleKeys: vi.fn(),
        parentClick: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('./bibleXMLHelpers', () => ({
    handBibleKeyContextMenuOpening: mocks.contextMenu,
    deleteBibleXML: mocks.deleteXML,
    resetBibleXMLToEmbeddedKJV: mocks.resetKJV,
    useBibleXMLInfo: () => ({ bibleInfo: state.info }),
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('../../helper/settingHelpers', async () => {
    const React = await import('react');
    return {
        useStateSettingBoolean: (_key: string, value: boolean) =>
            React.useState(value),
    };
});
vi.mock('../../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => (
        <Suspense fallback={<span className="suspense">Loading</span>}>
            {children}
        </Suspense>
    ),
}));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./bibleEditorDirtyHelpers', () => ({
    warnIfBibleKeyDirty: mocks.warnDirty,
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../settingHelpers', () => ({ forceReloadAppWindows: mocks.reload }));
// Its own test: `BibleXMLLangPackageComp.test.tsx`.
vi.mock('./BibleXMLLangPackageComp', () => ({ default: () => null }));
vi.mock('./BibleXMLDataPreviewComp', () => ({
    default: ({ bibleKey }: { bibleKey: string }) => (
        <div className="preview">Preview {bibleKey}</div>
    ),
}));

import BibleXMLInfoComp from './BibleXMLInfoComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render(bibleKey = 'KJV') {
    await act(async () => {
        // The list around the row: a press that stops here must not reach it.
        root.render(
            <div onClick={mocks.parentClick}>
                <BibleXMLInfoComp
                    bibleKey={bibleKey}
                    loadBibleKeys={mocks.loadBibleKeys}
                    filePath={`/bibles/${bibleKey}.xml`}
                />
            </div>,
        );
    });
}

function getButton(label: string) {
    return container.querySelector(
        `button[aria-label="${label}"]`,
    ) as HTMLButtonElement | null;
}

async function press(label: string) {
    const button = getButton(label);
    if (button === null) {
        throw new Error(`No ${label} button`);
    }
    await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await wait();
}

beforeEach(() => {
    state.info = { title: 'King James' };
    state.isDirty = false;
    mocks.warnDirty.mockImplementation(() => state.isDirty);
    mocks.confirm.mockResolvedValue(true);
    mocks.resetKJV.mockResolvedValue(true);
    mocks.deleteXML.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('a row of the Bible XML list', () => {
    test('names the Bible and opens its own menu', async () => {
        await render();
        const row = container.querySelector('li')!;
        expect(row.getAttribute('title')).toBe('King James /bibles/KJV.xml');
        expect(row.textContent).toContain('KJV');
        await act(async () => {
            row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        });
        expect(mocks.contextMenu).toHaveBeenCalledOnce();
        expect(mocks.contextMenu.mock.calls[0][0]).toBe('KJV');
    });

    test('only the KJV can be reset', async () => {
        await render('ESV');
        expect(getButton('Reset Bible XML')).toBeNull();
        await render('KJV');
        expect(getButton('Reset Bible XML')).not.toBeNull();
    });
});

describe('opening the editor', () => {
    test('loads the editor only when it is opened, and closes it again', async () => {
        await render();
        expect(container.querySelector('.preview')).toBeNull();
        await press('Show Editor');
        expect(container.querySelector('.preview')!.textContent).toBe(
            'Preview KJV',
        );
        expect(mocks.parentClick).toHaveBeenCalledOnce();
        const toggle = getButton('Show Editor')!;
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.title).toBe('Hide Editor');

        await press('Show Editor');
        expect(container.querySelector('.preview')).toBeNull();
        expect(mocks.warnDirty).toHaveBeenCalledWith(
            'KJV',
            'Save or discard unsaved Bible changes before closing the editor.',
        );
    });

    test('will not close an editor holding unsaved changes', async () => {
        await render();
        await press('Show Editor');
        state.isDirty = true;
        await press('Show Editor');
        expect(container.querySelector('.preview')).not.toBeNull();
    });
});

describe('resetting the KJV', () => {
    test('confirms, replaces the file, reloads the list and every window', async () => {
        await render();
        await press('Reset Bible XML');
        expect(mocks.parentClick).not.toHaveBeenCalled();
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Reset Bible XML',
            'Reset this bible XML with the app embedded KJV? ' +
                'All your changes will be lost.',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(mocks.resetKJV).toHaveBeenCalledWith('/bibles/KJV.xml');
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('unsaved changes stop it before anything is asked', async () => {
        state.isDirty = true;
        await render();
        await press('Reset Bible XML');
        expect(mocks.warnDirty).toHaveBeenCalledWith(
            'KJV',
            'Save or discard unsaved Bible changes before resetting.',
        );
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.resetKJV).not.toHaveBeenCalled();
    });

    test('a No, or a reset that failed, reloads nothing', async () => {
        await render();
        mocks.confirm.mockResolvedValueOnce(false);
        await press('Reset Bible XML');
        expect(mocks.resetKJV).not.toHaveBeenCalled();

        mocks.resetKJV.mockResolvedValueOnce(false);
        await press('Reset Bible XML');
        expect(mocks.resetKJV).toHaveBeenCalledOnce();
        expect(mocks.loadBibleKeys).not.toHaveBeenCalled();
        expect(mocks.reload).not.toHaveBeenCalled();
    });
});

describe('moving a Bible to the trash', () => {
    test('confirms by key, deletes it and reloads the list', async () => {
        await render('ESV');
        await press('Move to Trash');
        expect(mocks.parentClick).not.toHaveBeenCalled();
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Delete Bible XML',
            'Are you sure to delete bible XML "ESV"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(mocks.deleteXML).toHaveBeenCalledWith('ESV');
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
    });

    test('a No keeps it', async () => {
        mocks.confirm.mockResolvedValue(false);
        await render('ESV');
        await press('Move to Trash');
        expect(mocks.deleteXML).not.toHaveBeenCalled();
        expect(mocks.loadBibleKeys).not.toHaveBeenCalled();
    });
});
