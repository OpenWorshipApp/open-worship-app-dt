'use strict';
/* eslint-disable */

function getMSHelper({ modulePath, binaryPath, dotnetPath }) {
    process.env.DOTNET_ROOT = dotnetPath;
    const dotnet = require(modulePath);
    const msHelper = dotnet.require(binaryPath);
    return msHelper.Helper;
}

module.exports = { getMSHelper };
