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
      const msHelper = getMSHelper({ modulePath, binaryPath, dotnetPath });
      const isSuccessful = msHelper.pptxToHtmls(
        filePath,
        outputDirectory,
        eot2ttfPath,
      );
      process.send({ isSuccessful });
    } catch (error) {
      console.log('Error converting PowerPoint to HTMLs:', error.message);
      process.send({ isSuccessful: false, message: error.message });
    }
  },
);

setInterval(() => {
  console.log('"Pptx to HTMLs" still alive', Date.now());
}, 1e3);
