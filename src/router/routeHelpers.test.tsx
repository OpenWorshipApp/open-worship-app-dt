// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    setSetting: vi.fn(),
    currentHomePage: '/reader.html',
}));

vi.mock('../server/appProvider', () => ({
    default: {
        presenterHomePage: '/presenter.html',
        get currentHomePage() {
            return state.currentHomePage;
        },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
    setSetting: state.setSetting,
}));

import { goToPath, toTitleExternal, WindowModEnum } from './routeHelpers';

let location: { href: string };

beforeEach(() => {
    state.settings.clear();
    state.currentHomePage = '/reader.html';
    location = { href: 'https://localhost:3000/reader.html?x=1' };
    vi.stubGlobal('location', location);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('toTitleExternal', () => {
    test('is the label icon then the translated title, styled', () => {
        expect(
            renderToStaticMarkup(
                toTitleExternal('Presenter', { color: 'red' }),
            ),
        ).toBe(
            '<span style="color:red"><i class="bi bi-display px-1"></i>t:Presenter </span>',
        );
        expect(renderToStaticMarkup(toTitleExternal('Unmapped'))).toBe(
            '<span>t:Unmapped </span>',
        );
    });
});

describe('goToPath', () => {
    test('opens the page asked for and remembers where it came from', () => {
        goToPath('/editor.html');
        expect(location.href).toBe('https://localhost:3000/editor.html?x=1');
        expect(state.setSetting).toHaveBeenCalledExactlyOnceWith(
            'last-page-location',
            '/reader.html',
        );
    });

    test('with no page asked for it goes back to the remembered one', () => {
        state.settings.set('last-page-location', '/editor.html');
        goToPath();
        expect(location.href).toBe('https://localhost:3000/editor.html?x=1');
    });

    test('with nothing remembered it goes to the presenter', () => {
        goToPath();
        expect(location.href).toBe('https://localhost:3000/presenter.html?x=1');
    });

    test('never "goes back" to the page it is already on', () => {
        state.currentHomePage = '/editor.html';
        state.settings.set('last-page-location', '/editor.html');
        goToPath();
        expect(location.href).toBe('https://localhost:3000/presenter.html?x=1');
        expect(state.setSetting).toHaveBeenCalledWith(
            'last-page-location',
            '/editor.html',
        );
    });
});

describe('WindowModEnum', () => {
    test('numbers the three window modes', () => {
        expect([
            WindowModEnum.Editor,
            WindowModEnum.presenter,
            WindowModEnum.reader,
        ]).toEqual([0, 1, 2]);
    });
});
