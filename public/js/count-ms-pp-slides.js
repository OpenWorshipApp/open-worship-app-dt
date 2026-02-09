'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on('message', ({ filePath, modulePath, binaryPath, dotnetPath }) => {
    try {
        console.log(`Counting MS PP slides for ${filePath}`);
        const msHelper = getMSHelper({ modulePath, binaryPath, dotnetPath });
        const count = msHelper.countSlides(filePath);
        process.send(count);
    } catch (error) {
        console.log('Error counting MS PP slides:', error.message);
        process.send(null);
    }
});

setInterval(() => {
    console.log('"Count MS PP slides" still alive', Date.now());
}, 1e3);
