import { describe, expect, test } from 'vitest';

import { findOpenerWindowId, toWindowPage } from './windowAimHelpers';

// The window a help was opened from, and a window's page, when the address
// handed over is not one a URL can be made of.

const HOST = 'https://localhost:3000';
const WINDOW_LIST = [
    {
        id: 'MAIN',
        title: 'Open Worship app - Presenter (🖥️)',
        url: `${HOST}/presenter.html`,
        focus: 'presenter',
        isMain: true,
        label: 'Presenter · main window',
    },
    {
        id: 'SETTING',
        title: 'Open Worship app - Setting (⚙️)',
        url: `${HOST}/setting.html?uuid=setting`,
        focus: 'setting',
        isMain: false,
        label: 'Setting · own window',
    },
] as any[];

describe('the window the help was opened from', () => {
    test('an opener address that is no address is no aim, whatever the list holds', () => {
        expect(
            findOpenerWindowId(
                `${HOST}/setting.html?uuid=setting`,
                WINDOW_LIST,
            ),
        ).toBe('SETTING');
        expect(
            findOpenerWindowId(
                'https://local host:3000/setting.html?uuid=setting',
                WINDOW_LIST,
            ),
        ).toBeNull();
    });
});

describe('a window’s page as a tool finds it', () => {
    test('an address that cannot be read is handed on as written', () => {
        expect(toWindowPage(`${HOST}/setting.html?uuid=setting`)).toBe(
            'setting.html?uuid=setting',
        );
        expect(toWindowPage('setting.html?uuid=setting')).toBe(
            'setting.html?uuid=setting',
        );
        expect(toWindowPage('')).toBe('');
    });
});
