import { BrowserWindow } from 'electron';

export const OAUTH_WINDOW_CLOSED_MESSAGE = 'Sign in window was closed';

/**
 * Opens a browser window on `authorizeUrl` and resolves with the full URL of
 * the first navigation that lands on `redirectUriPrefix`. Generic on purpose:
 * any OAuth authorization-code flow can ride it. The matched redirect is
 * prevented from actually loading (its URI usually points nowhere), and the
 * window rejects with `OAUTH_WINDOW_CLOSED_MESSAGE` when the user closes it
 * before signing in.
 */
export function captureOAuthRedirectUrl({
    authorizeUrl,
    redirectUriPrefix,
}: {
    authorizeUrl: string;
    redirectUriPrefix: string;
}): Promise<string> {
    const protocol = new URL(authorizeUrl).protocol;
    if (!['http:', 'https:'].includes(protocol)) {
        throw new Error(`Invalid authorize URL "${authorizeUrl}"`);
    }
    if (!redirectUriPrefix) {
        throw new Error('redirectUriPrefix is required');
    }
    return new Promise<string>((resolve, reject) => {
        let isSettled = false;
        const win = new BrowserWindow({
            width: 500,
            height: 700,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: 'oauth-sign-in',
            },
        });
        const checkUrl = (url: string, event?: { preventDefault(): void }) => {
            if (isSettled || !url.startsWith(redirectUriPrefix)) {
                return;
            }
            isSettled = true;
            event?.preventDefault();
            resolve(url);
            win.destroy();
        };
        win.webContents.on('will-redirect', (event, url) => {
            checkUrl(url, event);
        });
        win.webContents.on('did-redirect-navigation', (_event, url) => {
            checkUrl(url);
        });
        win.webContents.on('did-navigate', (_event, url) => {
            checkUrl(url);
        });
        win.on('closed', () => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            reject(new Error(OAUTH_WINDOW_CLOSED_MESSAGE));
        });
        // A prevented redirect settles the promise first and then fails this
        // load with ERR_ABORTED — swallow it.
        win.loadURL(authorizeUrl).catch(() => {});
    });
}
