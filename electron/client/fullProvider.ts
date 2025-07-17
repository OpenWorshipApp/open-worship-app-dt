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

import appInfo from '../../package.json';
import { powerPointUtils } from './powerPointUtils';
import { ytUtils } from './ytUtils';

function toVersionNumber(version: string) {
    const [major, minor, patch] = version
        .split('.')
        .map((str) => parseInt(str, 10));
    return major * 10000 + minor * 100 + patch;
}

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
    appInfo: {
        name: appInfo.name,
        description: appInfo.description,
        author: appInfo.author,
        homepage: appInfo.homepage,
        version: appInfo.version,
        versionNumber: toVersionNumber(appInfo.version),
    },
    reload: () => {
        window.location.reload();
    },
    appUtils,
    databaseUtils,
    powerPointUtils,
    ytUtils,
};
