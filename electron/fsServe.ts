import fs from 'node:fs';
import path from 'node:path';
import { app, net, protocol, session, WebContents } from 'electron';

export const htmlFiles = {
    editor: 'editor.html',
    presenter: 'presenter.html',
    screen: 'screen.html',
    reader: 'reader.html',
    setting: 'setting.html',
    finder: 'finder.html',
    about: 'about.html',
    experiment: 'experiment.html',
};
export const preloadFileMap = {
    full: [
        htmlFiles.editor,
        htmlFiles.presenter,
        htmlFiles.reader,
        htmlFiles.setting,
    ],
    minimal: [htmlFiles.screen, htmlFiles.finder],
};
export const customScheme = 'owa';
export const schemePrivileges = {
    standard: true,
    secure: true,
    allowServiceWorkers: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
};

export const rootUrl = `${customScheme}://local`;
export const rootUrlAccess = `${customScheme}://access`;

function toFileFullPath(filePath: string) {
    try {
        const result = fs.statSync(filePath);
        if (result.isFile()) {
            return filePath;
        }
    } catch (_error) {}
    return null;
}

function genFilePathUrl(dirPath: string, url: string) {
    url = decodeURIComponent(new URL(url).pathname);
    let filePath = path.join(dirPath, url);
    filePath =
        toFileFullPath(filePath) ?? path.join(dirPath, htmlFiles.presenter);
    return `file://${filePath}`;
}

function handlerLocal(dirPath: string, url: string) {
    let urlPath = url;
    if (url.startsWith(rootUrl)) {
        urlPath = genFilePathUrl(dirPath, url);
    }
    return net.fetch(urlPath);
}

export function initCustomSchemeHandler() {
    const dirPath = path.resolve(app.getAppPath(), 'dist');
    protocol.handle(customScheme, (request) => {
        const url = request.url;
        if (url.startsWith(rootUrl)) {
            return handlerLocal(dirPath, url);
        }
        const fileUrl = `file://${url.slice(rootUrlAccess.length)}`;
        return net.fetch(fileUrl);
    });

    const webRequest = session.defaultSession.webRequest;
    webRequest.onHeadersReceived(
        { urls: ['https://*/*'] },
        (details, callback) => {
            if (details.responseHeaders) {
                details.responseHeaders['access-control-allow-headers'] = [
                    'x-api-key',
                    'content-type',
                ];
                details.responseHeaders['access-control-allow-origin'] = ['*'];
            }
            callback({ responseHeaders: details.responseHeaders });
        },
    );
}

export function toTitleCase(str: string) {
    return str[0].toUpperCase() + str.slice(1);
}

export function getCurrent(webContents: WebContents) {
    const url = new URL(webContents.getURL());
    const htmlFileFullName =
        url.pathname.substring(1).split('.html')[0] + '.html';
    const validHtmlFiles = [
        htmlFiles.editor,
        htmlFiles.presenter,
        htmlFiles.reader,
        htmlFiles.setting,
    ];
    const currentHtmlPath = validHtmlFiles.includes(htmlFileFullName)
        ? htmlFileFullName
        : htmlFiles.presenter;
    return currentHtmlPath;
}
