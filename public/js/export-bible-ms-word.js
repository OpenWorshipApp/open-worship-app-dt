'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on(
    'message',
    ({ filePath, modulePath, binaryPath, dotnetPath, data }) => {
        try {
            console.log(`Exporting Bible MS Word for ${filePath}`);
            const msHelper = getMSHelper({
                modulePath,
                binaryPath,
                dotnetPath,
            });
            const dataMap = data.map((item) => {
                const entry = new Map();
                entry.set('title', item.title);
                entry.set('body', item.body);
                entry.set('fontFamily', item.fontFamily ?? '');
                return entry;
            });

            msHelper.exportBibleMSWord(filePath, dataMap);
            process.send(true);
        } catch (error) {
            console.log(
                'Error exporting Bible MS Word:',

                error.message,
            );
            process.send(null);
        }
    },
);

setInterval(() => {
    console.log('"Export Bible MS Word" still alive', Date.now());
}, 1e3);
