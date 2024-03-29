import browserUtils from './browserUtils';
import cryptoUtils from './cryptoUtils';
import fileUtils from './fileUtils';
import httpUtils from './httpUtils';
import messageUtils from './messageUtils';
import systemUtils from './systemUtils';
import pathUtils from './pathUtils';
import appInfo from '../../package.json';
import fontUtils from './fontUtils';
import appUtils from './appUtils';
import pdfUtils from './pdfUtils';

const provider = {
    isMain: true,
    isPresent: false,
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
    pdfUtils,
    appInfo: {
        name: appInfo.name,
        description: appInfo.description,
        author: appInfo.author,
        homepage: appInfo.homepage,
        version: appInfo.version,
    },
    reload: () => {
        window.location.reload();
    },
    appUtils,
};

export default provider;
