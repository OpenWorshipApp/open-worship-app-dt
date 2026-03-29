'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on(
    'message',
    ({
        filePath,
        outputDirectory,
        eot2ttfPath,
        modulePath,
        binaryPath,
        dotnetPath,
    }) => {
        try {
            console.log(`Converting PowerPoint to HTMLs for ${filePath}`);
            const msHelper = getMSHelper({
                modulePath,
                binaryPath,
                dotnetPath,
            });
            const version = msHelper.getPptxToHtmlsVersion(
                filePath,
                outputDirectory,
                eot2ttfPath,
            );
            process.send({ version });
        } catch (error) {
            console.log('Error converting PowerPoint to HTMLs:', error.message);
            process.send({ version: null, message: error.message });
        }
    },
);

setInterval(() => {
    console.log('"Pptx to HTMLs" still alive', Date.now());
}, 1e3);
