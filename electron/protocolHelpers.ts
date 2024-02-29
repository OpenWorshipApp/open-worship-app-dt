import { BrowserWindow } from 'electron';

import { rootUrl as fsServeRootUrl } from './fsServe';
import { isDev } from './electronHelpers';

export function genRoutProps(name: string) {
    const preloadName = name === 'index' ? 'index' : 'minimal';
    const preloadFile = `${__dirname}/client/${preloadName}Preload.js`;
    const loadURL = (browserWindow: BrowserWindow, query: string = '') => {
        const urlPathname = name !== 'index' ? `${name}.html` : '';
        const rootUrl = isDev ? 'https://localhost:3000' : fsServeRootUrl;
        browserWindow.loadURL(`${rootUrl}/${urlPathname}${query}`);
    };
    return {
        loadURL,
        preloadFile,
    };
}
