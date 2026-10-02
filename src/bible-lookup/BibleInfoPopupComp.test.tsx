// @vitest-environment jsdom

import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: vi.fn() } },
}));
vi.mock('../app-modal/ModalComp', () => ({
    MODAL_KEYBOARD_LAYER: 'bible-lookup',
    ModalComp: ({ children }: PropsWithChildren) => children,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: () => {},
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    getLanguageTitle: () => '',
}));
vi.mock('../helper/appHooks', () => ({
    useAppStateAsync: () => [null],
    useAppCurrentRef: (current: unknown) => ({ current }),
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: async () => null,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));

import BibleInfoPopupComp from './BibleInfoPopupComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('BibleInfoPopupComp', () => {
    // A screen reader met a run of label/value text with no edge and no name.
    test('is a modal dialog named by its own title', () => {
        act(() => {
            root.render(<BibleInfoPopupComp bibleKey="KJV" close={() => {}} />);
        });
        const dialog = host.querySelector('[role="dialog"]')!;

        expect(dialog).not.toBeNull();
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        const titleId = dialog.getAttribute('aria-labelledby')!;
        expect(document.getElementById(titleId)?.textContent).toBe(
            'Bible Information',
        );
    });
});
