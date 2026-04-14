import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
    _electron as electron,
    expect,
    test as base,
    type ElectronApplication,
    type Page,
} from '@playwright/test';

const builtElectronEntryPath = path.join(
    process.cwd(),
    'electron-build',
    'electron',
    'index.js',
);
const builtRendererEntryPath = path.join(process.cwd(), 'dist', 'setting.html');

function ensureBuiltAppExists() {
    if (existsSync(builtElectronEntryPath) && existsSync(builtRendererEntryPath)) {
        return;
    }
    throw new Error(
        'The Electron production build is missing. Run "npm run test:e2e" or "npm run build" before invoking Playwright directly.',
    );
}

function createUserDataPath() {
    const userDataPath = mkdtempSync(path.join(os.tmpdir(), 'owa-playwright-'));
    writeFileSync(
        path.join(userDataPath, 'setting.json'),
        JSON.stringify({
            appScreenDisplayId: null,
            mainHtmlPath: 'setting.html',
            mainWinBounds: null,
            themeSource: 'system',
        }),
        'utf8',
    );
    return userDataPath;
}

type ElectronFixtures = {
    appWindow: Page;
    electronApp: ElectronApplication;
};

const test = base.extend<ElectronFixtures>({
    electronApp: async ({}, runFixture) => {
        ensureBuiltAppExists();
        const userDataPath = createUserDataPath();
        const electronApp = await electron.launch({
            args: ['.', '--disable-gpu'],
            cwd: process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: 'production',
                OWA_USER_DATA_PATH: userDataPath,
            },
            timeout: 60_000,
        });

        try {
            await runFixture(electronApp);
        } finally {
            await electronApp.close();
            rmSync(userDataPath, { force: true, recursive: true });
        }
    },
    appWindow: async ({ electronApp }, runFixture) => {
        const appWindow = await electronApp.firstWindow();
        await appWindow.waitForLoadState('domcontentloaded');
        await runFixture(appWindow);
    },
});

test('opens the settings shell', async ({ appWindow }) => {
    await expect.poll(() => appWindow.url()).toContain('setting.html');
    await expect(appWindow).toHaveTitle(/Settings/);
    await expect(
        appWindow.getByRole('button', { name: /Apply Settings/ }),
    ).toBeVisible();
    await expect(
        appWindow.getByRole('button', { name: 'General' }),
    ).toBeVisible();
    await expect(
        appWindow.getByRole('button', { name: /Set Default Data/ }),
    ).toBeVisible();
});
