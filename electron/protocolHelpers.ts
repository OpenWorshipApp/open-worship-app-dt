import { join } from 'node:path';
import { BrowserWindow } from 'electron';

import { rootUrl as fsServeRootUrl } from './fsServe';
import { isDev } from './electronHelpers';

export function genRoutProps(htmlFileFullName: string) {
    const preloadFilePath = join(__dirname, 'client', 'preloadProvider.js');
    const loadURL = (browserWindow: BrowserWindow, query: string = '') => {
        const rootUrl = isDev ? 'https://localhost:3000' : fsServeRootUrl;
        browserWindow.loadURL(`${rootUrl}/${htmlFileFullName}${query}`);
    };
    return { loadURL, preloadFilePath };
}
