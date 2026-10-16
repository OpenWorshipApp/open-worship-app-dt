// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    info: null as Record<string, unknown> | null,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `translated:${text}`,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('./bibleXMLHelpers', () => ({
    handBibleKeyContextMenuOpening: vi.fn(),
    deleteBibleXML: vi.fn(),
    resetBibleXMLToEmbeddedKJV: vi.fn(),
    useBibleXMLInfo: () => ({ bibleInfo: state.info }),
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(),
}));
vi.mock('../../helper/settingHelpers', async () => {
    const React = await import('react');
    return {
        useStateSettingBoolean: (_key: string, value: boolean) =>
            React.useState(value),
    };
});
vi.mock('../../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: unknown }) => children,
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
    warnIfBibleKeyDirty: () => false,
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../settingHelpers', () => ({ forceReloadAppWindows: vi.fn() }));
vi.mock('./BibleXMLDataPreviewComp', () => ({ default: () => null }));

import BibleXMLInfoComp from './BibleXMLInfoComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(
            <BibleXMLInfoComp
                bibleKey="KSV"
                loadBibleKeys={vi.fn()}
                filePath="/bibles/KSV.xml"
            />,
        );
    });
}

describe('BibleXMLInfoComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('an imported Bible shows the link it came from and its whole note', async () => {
        const note =
            'Imported on 2026-10-15 07:03 UTC by the assistant (Chatbot).\n' +
            'Downloaded from: https://example.org/KhmerBible.xml\n' +
            'File link used: https://raw.example.org/KhmerBible.xml';
        state.info = { title: 'Khmer Standard Version', note };
        await render();
        const link = container.querySelector('a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe(
            'https://example.org/KhmerBible.xml',
        );
        expect(link.target).toBe('_blank');
        expect(link.textContent).toBe('https://example.org/KhmerBible.xml');
        expect(container.textContent).toContain('translated:Source:');
        const details = container.querySelector('details')!;
        expect(details.open).toBe(false);
        expect(details.querySelector('summary')?.textContent).toBe(
            'translated:Note',
        );
        expect(details.textContent).toContain('File link used:');
    });

    test('a note with no link has no link, and a Bible with no note shows neither', async () => {
        state.info = { title: 'Typed by hand', note: 'From the pastor.' };
        await render();
        expect(container.querySelector('a')).toBeNull();
        expect(container.querySelector('details')?.textContent).toContain(
            'From the pastor.',
        );
        state.info = { title: 'KJV', note: '  ' };
        await render();
        expect(container.querySelector('details')).toBeNull();
        state.info = { title: 'Old file' };
        await render();
        expect(container.querySelector('details')).toBeNull();
        expect(container.textContent).not.toContain('translated:Source');
    });
});
