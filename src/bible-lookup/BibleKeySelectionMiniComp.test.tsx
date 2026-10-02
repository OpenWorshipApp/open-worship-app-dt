// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { pressElementLikeButtonMock } = vi.hoisted(() => ({
    pressElementLikeButtonMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    getLanguageTitle: () => '',
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: pressElementLikeButtonMock,
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppStateAsync: () => [null, () => {}],
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: null,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: vi.fn(async () => []),
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: vi.fn(async () => null),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: vi.fn(),
}));
vi.mock('../setting/settingHelpers', () => ({
    openBibleSetting: vi.fn(),
}));

import { BibleKeySelectionMiniComp } from './BibleKeySelectionComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    pressElementLikeButtonMock.mockClear();
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

function renderChip(isChangeable: boolean) {
    act(() => {
        root.render(
            <BibleKeySelectionMiniComp
                bibleKey="KJV"
                onBibleKeyChange={isChangeable ? () => {} : undefined}
                contextMenuTitle="Add an extra Bible"
            />,
        );
    });
    return host.querySelector('.bible-selector')!;
}

function pressEnterOn(element: Element) {
    act(() => {
        element.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
    });
}

describe('BibleKeySelectionMiniComp', () => {
    // On the "is not available!" card this chip is the one way forward, and
    // it was a bare span: no keyboard reached it and nothing named it.
    test('a chip that changes the bible is a named tab stop that opens a menu', () => {
        const chip = renderChip(true);

        expect(chip.getAttribute('role')).toBe('button');
        expect(chip.getAttribute('tabindex')).toBe('0');
        expect(chip.getAttribute('aria-label')).toBe('Change Bible Key: KJV');
        expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    });

    test('Enter on the chip presses it', () => {
        pressEnterOn(renderChip(true));

        expect(pressElementLikeButtonMock).toHaveBeenCalledTimes(1);
    });

    test('Enter on the ⋮ inside the chip is not also a press of the chip', () => {
        // The ⋮ ADDS a bible; the chip REPLACES the one shown.
        const dotsButton = renderChip(true).querySelector('button')!;

        pressEnterOn(dotsButton);

        expect(pressElementLikeButtonMock).not.toHaveBeenCalled();
    });

    test('a chip that only shows the key is not a control', () => {
        const chip = renderChip(false);

        expect(chip.getAttribute('role')).toBeNull();
        expect(chip.getAttribute('tabindex')).toBeNull();
        expect(chip.getAttribute('aria-label')).toBeNull();
    });
});
