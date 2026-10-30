// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    toBibleTextStyleView,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import {
    genBibleBackdropPatch,
    genBibleTextEffectPatch,
    genBibleTextLookList,
} from './bibleTextLookHelpers';
import BibleTextLookTileComp from './BibleTextLookTileComp';

const state = vi.hoisted(() => ({
    view: null as unknown as BibleTextStyleViewType,
    applyStyle: vi.fn(),
}));

vi.mock('./BibleCustomStyleComp.scss', () => ({}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../_screen/preview/stylingHelpers', () => ({
    useBibleTextStyleEditing: () => [state.view, state.applyStyle],
}));
// Both have suites of their own; here they only have to be where they go.
vi.mock('./BibleTextControlsComp', () => ({
    default: ({ backdrop }: { backdrop: string }) => (
        <div className="controls-stub">{backdrop}</div>
    ),
}));
vi.mock('./BibleTextPresetTilesComp', () => ({
    default: ({ sample }: { sample: string }) => (
        <button type="button" className="saved-look-stub">
            {sample}
        </button>
    ),
}));

import BibleCustomStyleComp from './BibleCustomStyleComp';

let host: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
    act(() => {
        root.render(node);
    });
}

function buttonByTitle(title: string) {
    return host.querySelector<HTMLButtonElement>(`button[title="${title}"]`)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Bible Properties panel', () => {
    test('shows the verse on the background its words are for, with the matching look lit', () => {
        const outline = genBibleTextLookList('dark').find(
            (look) => look.id === 'outline',
        )!;
        state.view = toBibleTextStyleView({
            color: '#FFFFFF',
            textShadow: outline.textShadow,
            effect: outline.effect,
            lineHeight: 1.4,
            textAlign: 'center',
        });

        render(<BibleCustomStyleComp />);

        const stage = host.querySelector('.bible-style-stage')!;
        expect(stage.classList.contains('bible-style-on-dark')).toBe(true);
        const verse = host.querySelector<HTMLElement>('.bible-style-verse')!;
        expect(verse.textContent).toContain('For God so loved the world');
        expect(verse.style.lineHeight).toBe('1.4');
        expect(verse.style.textAlign).toBe('center');
        expect(
            buttonByTitle('Light words for a dark background').getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');

        const tiles = [...host.querySelectorAll('.bible-style-look')];
        expect(tiles.map((tile) => tile.getAttribute('title'))).toEqual([
            'Normal',
            'Thin Outline',
            'Outline',
            'Heavy Outline',
            'Soft Shadow',
            'Deep Shadow',
            'Hard Shadow',
            'Lifted',
            'Glow',
            'Haze',
            'Halo',
            'Blue Edge',
        ]);
        const lit = tiles.filter(
            (tile) => tile.getAttribute('aria-pressed') === 'true',
        );
        expect(lit.map((tile) => tile.getAttribute('title'))).toEqual([
            'Outline',
        ]);
        // The saved looks follow in the same grid, and the rows come last.
        expect(
            host.querySelector('.bible-style-looks .saved-look-stub'),
        ).not.toBeNull();
        expect(host.querySelector('.controls-stub')?.textContent).toBe('dark');
    });

    test('carries the look across when the background is switched', () => {
        state.view = toBibleTextStyleView({ color: '#FFFFFF' });

        render(<BibleCustomStyleComp />);
        act(() => {
            buttonByTitle('Dark words for a light background').click();
        });

        expect(state.applyStyle).toHaveBeenCalledWith(
            genBibleBackdropPatch(state.view, 'light'),
        );
        expect(state.applyStyle.mock.calls[0][0].color).toBe('#000000');
    });

    test('applies a look by its effect and the shadow it draws', () => {
        state.view = toBibleTextStyleView({ color: '#000000' });

        render(<BibleCustomStyleComp />);
        expect(
            host
                .querySelector('.bible-style-stage')
                ?.classList.contains('bible-style-on-light'),
        ).toBe(true);
        act(() => {
            buttonByTitle('Glow').click();
        });

        const glow = genBibleTextLookList('light').find(
            (look) => look.id === 'glow',
        )!;
        expect(state.applyStyle).toHaveBeenCalledWith(
            genBibleTextEffectPatch(glow.effect),
        );
    });
});

describe('a look tile', () => {
    test('offers its menu only on the look being worn, without also picking it', () => {
        const onPick = vi.fn();
        const onMenuOpening = vi.fn();
        render(
            <BibleTextLookTileComp
                label="My look"
                sample="Aa"
                sampleStyle={{ color: 'red' }}
                backdrop="dark"
                isOn
                onPick={onPick}
                onMenuOpening={onMenuOpening}
            />,
        );

        const dots = host.querySelector<HTMLElement>('.bible-style-look-menu')!;
        act(() => {
            dots.click();
        });
        expect(onMenuOpening).toHaveBeenCalledOnce();
        expect(onPick).not.toHaveBeenCalled();

        act(() => {
            host.querySelector('button')!.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(onMenuOpening).toHaveBeenCalledTimes(2);

        render(
            <BibleTextLookTileComp
                label="My look"
                sample="Aa"
                sampleStyle={{}}
                backdrop="light"
                isOn={false}
                onPick={onPick}
                onMenuOpening={onMenuOpening}
            />,
        );
        expect(host.querySelector('.bible-style-look-menu')).toBeNull();
        act(() => {
            host.querySelector('button')!.click();
        });
        expect(onPick).toHaveBeenCalledOnce();
    });
});
