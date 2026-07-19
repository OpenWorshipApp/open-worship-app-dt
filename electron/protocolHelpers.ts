import { join } from 'node:path';
import { type BrowserWindow } from 'electron';

import { rootUrl as fsServeRootUrl } from './fsServe';
import { isDev } from './electronHelpers';

export function getRootUrl() {
    return isDev ? 'https://localhost:3000' : fsServeRootUrl;
}

// The single source of truth for the URL a main-window html file is served
// from. Both window creation (genRoutProps) and navigation validation build
// their URLs through this, so they can never drift apart.
export function genRouteUrl(htmlFileFullName: string, query: string = '') {
    return `${getRootUrl()}/${htmlFileFullName}${query}`;
}

export function genRoutProps(htmlFileFullName: string) {
    const preloadFilePath = join(__dirname, 'client', 'preloadProvider.js');
    const loadURL = (browserWindow: BrowserWindow, query: string = '') => {
        browserWindow.loadURL(genRouteUrl(htmlFileFullName, query));
    };
    return { loadURL, preloadFilePath };
}
