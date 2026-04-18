// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock } = vi.hoisted(() => ({
    appProviderMock: {
        presenterHomePage: '/presenter.html',
        currentHomePage: '/editor.html',
    },
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => `translated:${value}`,
}));

import { goToPath, toTitleExternal } from './routeHelpers';

function stubNavigation(initialHref: string, storedPath: string | null) {
    const storage = new Map<string, string>();
    if (storedPath !== null) {
        storage.set('last-page-location', storedPath);
    }
    const localStorageMock = {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
        }),
    };
    const locationMock = { href: initialHref };
    vi.stubGlobal('localStorage', localStorageMock as any);
    vi.stubGlobal('location', locationMock as any);
    return { localStorageMock, locationMock };
}

describe('routeHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('builds an external-link title element', () => {
        const element = toTitleExternal('Open', {
            color: 'red',
        }) as ReactElement;

        expect(element.type).toBe('span');
        expect(element.props.style).toEqual({ color: 'red' });
        expect(element.props.children[0]).toBe('translated:Open ');
        expect(element.props.children[1].type).toBe('i');
        expect(element.props.children[1].props.className).toContain(
            'bi-box-arrow-up-right',
        );
    });

    test('navigates to the stored path or presenter home when no pathname is supplied', () => {
        const { localStorageMock, locationMock } = stubNavigation(
            'https://app.test/editor.html?tab=1',
            '/library.html',
        );

        goToPath();

        expect(locationMock.href).toBe('https://app.test/library.html?tab=1');
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'last-page-location',
            '/editor.html',
        );

        const fallback = stubNavigation(
            'https://app.test/editor.html',
            null,
        );

        goToPath();

        expect(fallback.locationMock.href).toBe(
            'https://app.test/presenter.html',
        );
        expect(fallback.localStorageMock.getItem).toHaveBeenCalledWith(
            'last-page-location',
        );
    });

    test('redirects current-home paths to the presenter home page', () => {
        const { localStorageMock, locationMock } = stubNavigation(
            'https://app.test/editor.html?tab=2',
            null,
        );

        goToPath('/editor.html/slides');

        expect(locationMock.href).toBe('https://app.test/presenter.html?tab=2');
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'last-page-location',
            '/editor.html',
        );
    });

    test('navigates to explicit external paths unchanged', () => {
        const { locationMock } = stubNavigation(
            'https://app.test/editor.html',
            null,
        );

        goToPath('/screen-preview.html');

        expect(locationMock.href).toBe('https://app.test/screen-preview.html');
    });
});
