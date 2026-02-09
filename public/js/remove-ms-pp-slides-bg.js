'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on('message', ({ filePath, modulePath, binaryPath, dotnetPath }) => {
    try {
        console.log(`Removing MS PP slides background for ${filePath}`);
        const msHelper = getMSHelper({ modulePath, binaryPath, dotnetPath });
        const isSuccess = msHelper.removeSlideBackground(filePath);
        process.send(isSuccess);
    } catch (error) {
        console.log('Error removing MS PP slides background:', error.message);
        process.send(null);
    }
});

setInterval(() => {
    console.log('"Remove MS PP slides background" still alive', Date.now());
}, 1e3);
