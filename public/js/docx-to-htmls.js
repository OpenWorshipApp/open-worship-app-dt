'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on(
  'message',
  ({ filePath, outputDirectory, modulePath, binaryPath, dotnetPath }) => {
    try {
      console.log(`Converting DOCX to HTMLs for ${filePath}`);
      const msHelper = getMSHelper({ modulePath, binaryPath, dotnetPath });
      const isSuccessful = msHelper.docxToHtmls(filePath, outputDirectory);
      process.send({ isSuccessful });
    } catch (error) {
      console.log('Error converting DOCX to HTMLs:', error.message);
      process.send({ isSuccessful: false, message: error.message });
    }
  },
);

setInterval(() => {
  console.log('"Docx to HTMLs" still alive', Date.now());
}, 1e3);
