import fs from 'node:fs';
import path from 'node:path';
import { app, net, protocol, session, type WebContents } from 'electron';

import appInfo from '../package.json';

export const htmlFiles = {
    appDocumentEditor: 'appDocumentEditor.html',
    presenter: 'presenter.html',
    screen: 'screen.html',
    reader: 'reader.html',
    setting: 'setting.html',
    finder: 'finder.html',
    lwShare: 'lwShare.html',
    about: 'about.html',
    experiment: 'experiment.html',
    lyricEditor: 'lyricEditor.html',
    bibleNote: 'bibleNote.html',
    webEditor: 'webEditor.html',
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
const externalRequestReferrer = new URL(appInfo.homepage).href;

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
    let filePath: string | null = path.resolve(path.join(dirPath, url));
    // Contain resolution within the app's dist dir — `..` segments must not
    // escape it and get served from the app's trusted origin.
    if (filePath !== dirPath && !filePath.startsWith(dirPath + path.sep)) {
        filePath = null;
    }
    filePath =
        (filePath !== null ? toFileFullPath(filePath) : null) ??
        path.join(dirPath, htmlFiles.presenter);
    return `file://${filePath}`;
}

function handlerLocal(dirPath: string, url: string) {
    let urlPath = url;
    if (url.startsWith(rootUrl)) {
        urlPath = genFilePathUrl(dirPath, url);
    }
    return net.fetch(urlPath);
}

function setResponseHeader(
    responseHeaders: Record<string, string[]>,
    headerName: string,
    value: string[],
) {
    const matchingHeaderNames = Object.keys(responseHeaders).filter((key) => {
        return key.toLowerCase() === headerName;
    });
    for (const matchingHeaderName of matchingHeaderNames) {
        delete responseHeaders[matchingHeaderName];
    }
    responseHeaders[matchingHeaderNames[0] ?? headerName] = value;
}

function getRequestHeader(
    requestHeaders: Record<string, string> | undefined,
    headerName: string,
) {
    const matchingHeaderName = Object.keys(requestHeaders ?? {}).find((key) => {
        return key.toLowerCase() === headerName;
    });
    return matchingHeaderName
        ? requestHeaders?.[matchingHeaderName]
        : undefined;
}

function setRequestHeader(
    requestHeaders: Record<string, string>,
    headerName: string,
    value: string,
) {
    const matchingHeaderName = Object.keys(requestHeaders).find((key) => {
        return key.toLowerCase() === headerName;
    });
    requestHeaders[matchingHeaderName ?? headerName] = value;
}

function isHttpUrl(urlString: string | undefined) {
    if (!urlString || !URL.canParse(urlString)) {
        return false;
    }
    const protocol = new URL(urlString).protocol;
    return protocol === 'http:' || protocol === 'https:';
}

function ensureExternalRequestReferrer(details: {
    url?: string;
    referrer?: string;
    requestHeaders: Record<string, string>;
}) {
    if (!isHttpUrl(details.url)) {
        return;
    }
    const requestReferrer =
        getRequestHeader(details.requestHeaders, 'referer') ?? details.referrer;
    if (requestReferrer && !requestReferrer.startsWith(rootUrl)) {
        return;
    }
    setRequestHeader(
        details.requestHeaders,
        'referer',
        externalRequestReferrer,
    );
}

function toUrlOrigin(urlString: string | undefined) {
    if (!urlString || !URL.canParse(urlString)) {
        return null;
    }
    return new URL(urlString).origin;
}

export function initCustomSchemeHandler() {
    const dirPath = path.resolve(app.getAppPath(), 'dist');
    protocol.handle(customScheme, (request) => {
        const url = request.url;
        if (url.startsWith(rootUrl)) {
            return handlerLocal(dirPath, url);
        }
        // `owa://access` maps straight to local files. Only requests initiated
        // by the app's own pages (origin `owa://local`) may use it — without
        // this gate, any loaded web content (which runs with webSecurity off)
        // could read arbitrary local files via fetch().
        const referrer = request.referrer ?? '';
        if (!url.startsWith(rootUrlAccess) || !referrer.startsWith(rootUrl)) {
            return new Response('Not Found', { status: 404 });
        }
        const fileUrl = `file://${url.slice(rootUrlAccess.length)}`;
        return net.fetch(fileUrl);
    });

    const webRequest = session.defaultSession.webRequest;
    const requestOriginById = new Map<number, string>();
    const requestHeadersById = new Map<number, string>();
    const externalUrlFilter = { urls: ['http://*/*', 'https://*/*'] };
    const clearRequestEntries = (details: { id: number }) => {
        requestOriginById.delete(details.id);
        requestHeadersById.delete(details.id);
    };
    // Requests that never reach onHeadersReceived (aborted/failed) must still
    // release their map entries, or the maps grow for the app's lifetime.
    webRequest.onCompleted(externalUrlFilter, clearRequestEntries);
    webRequest.onErrorOccurred(externalUrlFilter, clearRequestEntries);
    webRequest.onBeforeSendHeaders(externalUrlFilter, (details, callback) => {
        const requestOrigin =
            getRequestHeader(details.requestHeaders, 'origin') ??
            toUrlOrigin(getRequestHeader(details.requestHeaders, 'referer')) ??
            toUrlOrigin(details.referrer);
        const requestedHeaders = getRequestHeader(
            details.requestHeaders,
            'access-control-request-headers',
        );
        ensureExternalRequestReferrer(details);
        if (requestOrigin) {
            requestOriginById.set(details.id, requestOrigin);
        }
        if (requestedHeaders) {
            requestHeadersById.set(details.id, requestedHeaders);
        }
        callback({ requestHeaders: details.requestHeaders });
    });
    webRequest.onHeadersReceived(externalUrlFilter, (details, callback) => {
        const requestOrigin = requestOriginById.get(details.id);
        requestOriginById.delete(details.id);
        const requestedHeaders = requestHeadersById.get(details.id);
        requestHeadersById.delete(details.id);
        if (details.responseHeaders) {
            setResponseHeader(
                details.responseHeaders,
                'access-control-allow-headers',
                requestedHeaders
                    ? [requestedHeaders]
                    : [
                          'authorization',
                          'content-type',
                          'x-api-key',
                          'x-goog-api-key',
                      ],
            );
            setResponseHeader(
                details.responseHeaders,
                'access-control-allow-methods',
                ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            );
            setResponseHeader(
                details.responseHeaders,
                'access-control-allow-origin',
                [requestOrigin ?? '*'],
            );
            if (requestOrigin) {
                setResponseHeader(
                    details.responseHeaders,
                    'access-control-allow-credentials',
                    ['true'],
                );
            }
            setResponseHeader(
                details.responseHeaders,
                'access-control-expose-headers',
                ['*'],
            );
        }
        callback({ responseHeaders: details.responseHeaders });
    });
}

export function toTitleCase(str: string) {
    return str[0].toUpperCase() + str.slice(1);
}

export function getCurrent(webContents: WebContents) {
    const url = new URL(webContents.getURL());
    const htmlFileFullName =
        url.pathname.substring(1).split('.html')[0] + '.html';
    const validHtmlFiles = [
        htmlFiles.appDocumentEditor,
        htmlFiles.presenter,
        htmlFiles.reader,
        htmlFiles.setting,
    ];
    const currentHtmlPath = validHtmlFiles.includes(htmlFileFullName)
        ? htmlFileFullName
        : htmlFiles.presenter;
    return currentHtmlPath;
}
