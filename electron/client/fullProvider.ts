import browserUtils from './browserUtils';
import cryptoUtils from './cryptoUtils';
import fileUtils from './fileUtils';
import httpUtils from './httpUtils';
import messageUtils from './messageUtils';
import systemUtils from './systemUtils';
import pathUtils from './pathUtils';
import fontUtils from './fontUtils';
import appUtils from './appUtils';
import databaseUtils from './databaseUtils';

import { msUtils } from './msUtils';
import { ytUtils } from './ytUtils';
import appInfo from './appInfo';

export const provider = {
    appType: 'desktop',
    isDesktop: true,
    fontUtils,
    cryptoUtils,
    browserUtils,
    messageUtils,
    httpUtils,
    pathUtils,
    fileUtils,
    systemUtils,
    appInfo,
    reload: () => {
        globalThis.location.reload();
    },
    appUtils,
    databaseUtils,
    msUtils,
    ytUtils,
};
