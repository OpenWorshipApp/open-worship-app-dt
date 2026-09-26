/**
 * The capture wall's rules, against the REAL address dialect. The point of
 * reading `webUrlPolicy.mjs` itself rather than a stub is that `127.1`,
 * `0x7f.1` and `localtest.me` are exactly what a hand-written twin gets wrong.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => {
    return {
        session: { fromPartition: vi.fn() },
    };
});
vi.mock('./aiHelpers', () => {
    return { importEsm: vi.fn(), toMcpPackagePath: vi.fn() };
});

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkIsLocalHostname } from '../tools/owa-devtools-mcp/webUrlPolicy.mjs';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../src/helper/constants';
import {
    checkIsCaptureNavigationAllowed,
    checkIsCaptureRequestAllowed,
    checkIsCaptureRequestAllowedForTarget,
    checkIsCaptureUrlAllowed,
    checkIsPathInsideDir,
    resolveCaptureTarget,
    toCaptureDirPath,
    WEB_CAPTURE_DEFAULT_DIR_NAME,
    WEB_CAPTURE_DIR_SETTING_NAME_PREFIX,
} from './webCaptureHelpers';

const policy = { checkIsLocalHostname };

function checkAllowed(url: string, captureHostname: string) {
    return checkIsCaptureRequestAllowed(url, captureHostname, policy);
}

// Written the way the running app writes them, so every assertion below reads
// the same on Windows, macOS and Linux.
const dataDirPath = path.resolve(path.join('data-dir'));
const websDirPath = path.join(dataDirPath, WEB_CAPTURE_DEFAULT_DIR_NAME);
const elsewhereDirPath = path.resolve(path.join('somewhere-else'));

function toFileUrl(...parts: string[]) {
    return pathToFileURL(path.join(...parts)).toString();
}

async function resolveTarget(url: string, dirPathList = [websDirPath]) {
    return await resolveCaptureTarget(url, async () => {
        return dirPathList;
    });
}

describe('checkIsCaptureUrlAllowed', () => {
    it('takes a web address', () => {
        expect(checkIsCaptureUrlAllowed('https://example.com/a')).toBe(true);
        expect(checkIsCaptureUrlAllowed('http://192.168.1.50/notices')).toBe(
            true,
        );
    });

    it('refuses anything that is not one', () => {
        // The disk read `webSecurity: false` would otherwise allow.
        expect(
            checkIsCaptureUrlAllowed('file:///C:/Users/me/setting.json'),
        ).toBe(false);
        expect(checkIsCaptureUrlAllowed('data:text/html,<b>hi')).toBe(false);
        expect(checkIsCaptureUrlAllowed('owa://local/presenter.html')).toBe(
            false,
        );
        expect(checkIsCaptureUrlAllowed('not a url')).toBe(false);
    });
});

describe("the app's own local pages", () => {
    it('names the folders the way the renderer does', () => {
        // `electron/` may not import from `src/`, so the two copies are held
        // together here: a rename there with no change to the copy would
        // silently switch every local web tile back off.
        expect(WEB_CAPTURE_DIR_SETTING_NAME_PREFIX).toBe(
            dirSourceSettingNames.BACKGROUND_WEB,
        );
        expect(WEB_CAPTURE_DEFAULT_DIR_NAME).toBe(
            defaultDataDirNames.BACKGROUND_WEB,
        );
    });

    it('reads a directory setting the way the data folder stores it', () => {
        expect(toCaptureDirPath('$DATA_DIR_PATH\\webs', dataDirPath)).toBe(
            websDirPath,
        );
        // The same folder written by the other OS family.
        expect(toCaptureDirPath('$DATA_DIR_PATH/webs\n', dataDirPath)).toBe(
            websDirPath,
        );
        expect(toCaptureDirPath(elsewhereDirPath, dataDirPath)).toBe(
            elsewhereDirPath,
        );
        expect(toCaptureDirPath('', dataDirPath)).toBe(null);
        expect(toCaptureDirPath('webs', dataDirPath)).toBe(null);
    });

    it('takes a page out of a folder the Webs panel was pointed at', async () => {
        await expect(
            resolveTarget(toFileUrl(websDirPath, 'snow.html')),
        ).resolves.toEqual({ kind: 'file', dirPath: websDirPath });
        await expect(
            resolveTarget(toFileUrl(websDirPath, 'deep', 'a.htm')),
        ).resolves.toEqual({ kind: 'file', dirPath: websDirPath });
        // A second Web Show panel pointed somewhere of its own.
        await expect(
            resolveTarget(toFileUrl(elsewhereDirPath, 'a.html'), [
                websDirPath,
                elsewhereDirPath,
            ]),
        ).resolves.toEqual({ kind: 'file', dirPath: elsewhereDirPath });
    });

    it('takes nothing else off the disk', async () => {
        for (const url of [
            // The document a shared `.owadoc` carries, naming another
            // machine's folders.
            toFileUrl(elsewhereDirPath, 'a.html'),
            // A page is what a website item shows; this is not one.
            toFileUrl(websDirPath, 'setting.json'),
            // `..` resolved away before the folder is compared.
            toFileUrl(websDirPath, '..', 'documents', 'a.html'),
            // A machine on the room's network wearing a file URL.
            'file://server/share/a.html',
            'data:text/html,<b>hi',
            'owa://local/presenter.html',
        ]) {
            await expect(resolveTarget(url), url).resolves.toBe(null);
        }
    });

    it('lets a local page read its own folder and nowhere else', () => {
        const target = { kind: 'file', dirPath: websDirPath } as const;
        const checkFileAllowed = (url: string) => {
            return checkIsCaptureRequestAllowedForTarget(url, target, policy);
        };
        expect(checkFileAllowed(toFileUrl(websDirPath, 'snow.html'))).toBe(
            true,
        );
        expect(checkFileAllowed(toFileUrl(websDirPath, 'a', 'b.png'))).toBe(
            true,
        );
        expect(
            checkFileAllowed(toFileUrl(dataDirPath, 'local-storage', 'x')),
        ).toBe(false);
        expect(checkFileAllowed('https://fonts.example.com/a.woff')).toBe(true);
        expect(checkFileAllowed('http://127.0.0.1:39223/mcp')).toBe(false);
        expect(checkFileAllowed('http://192.168.1.1/admin')).toBe(false);
    });

    it('lets a SITE read no file at all', () => {
        expect(
            checkIsCaptureRequestAllowedForTarget(
                toFileUrl(websDirPath, 'snow.html'),
                { kind: 'web', hostname: 'example.com' },
                policy,
            ),
        ).toBe(false);
    });

    it('lets a local page walk only inside its own folder', () => {
        const target = { kind: 'file', dirPath: websDirPath } as const;
        expect(
            checkIsCaptureNavigationAllowed(
                toFileUrl(websDirPath, 'clock.html'),
                target,
            ),
        ).toBe(true);
        expect(
            checkIsCaptureNavigationAllowed(
                toFileUrl(elsewhereDirPath, 'a.html'),
                target,
            ),
        ).toBe(false);
        expect(
            checkIsCaptureNavigationAllowed(toFileUrl(websDirPath, 'a.html'), {
                kind: 'web',
                hostname: 'example.com',
            }),
        ).toBe(false);
    });

    it('knows what sits inside a folder', () => {
        expect(checkIsPathInsideDir(websDirPath, websDirPath)).toBe(false);
        expect(checkIsPathInsideDir(websDirPath, `${websDirPath}-other`)).toBe(
            false,
        );
        expect(
            checkIsPathInsideDir(websDirPath, path.join(websDirPath, 'a.html')),
        ).toBe(true);
    });
});

describe('checkIsCaptureRequestAllowed', () => {
    it('lets a public page reach the public internet', () => {
        expect(checkAllowed('https://example.com/a.png', 'example.com')).toBe(
            true,
        );
        expect(checkAllowed('https://cdn.other.com/a.js', 'example.com')).toBe(
            true,
        );
    });

    it('never lets a public page reach this machine', () => {
        for (const url of [
            'http://127.0.0.1:39223/mcp',
            'http://127.0.0.2:9223/json/version',
            'http://localhost:3000/presenter.html',
            'http://127.1/',
            'ws://127.0.0.1:9223/devtools/page/1',
            'http://[::1]:39223/mcp',
        ]) {
            expect(checkAllowed(url, 'example.com')).toBe(false);
        }
    });

    it('never lets a public page reach the room', () => {
        for (const url of [
            'http://192.168.1.1/admin',
            'http://10.0.0.5/nas',
            'http://172.16.4.9/printer',
            'http://nas.local/share',
        ]) {
            expect(checkAllowed(url, 'example.com')).toBe(false);
        }
    });

    it('lets the intranet notice board load ITSELF', () => {
        expect(
            checkAllowed('http://192.168.1.50/logo.png', '192.168.1.50'),
        ).toBe(true);
        expect(
            checkAllowed('http://10.0.0.5/a.css', '10.0.0.5'),
            'own host',
        ).toBe(true);
    });

    it('does not let it reach the rest of the room', () => {
        expect(checkAllowed('http://192.168.1.1/admin', '192.168.1.50')).toBe(
            false,
        );
        expect(checkAllowed('http://127.0.0.1:39223/mcp', '192.168.1.50')).toBe(
            false,
        );
    });

    it('gives this machine no same-host exemption at all', () => {
        // A slide pointed at the app's own door may not walk to the next port,
        // nor to itself: loopback is where both doors live.
        expect(
            checkAllowed('http://127.0.0.1:9223/json/list', '127.0.0.1'),
        ).toBe(false);
        expect(checkAllowed('http://localhost:3000/a', 'localhost')).toBe(
            false,
        );
    });

    it('refuses a request it cannot parse', () => {
        expect(checkAllowed('not a url', 'example.com')).toBe(false);
    });
});
