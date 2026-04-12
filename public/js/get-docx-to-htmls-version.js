'use strict';
/* eslint-disable */

const { getMSHelper } = require('./msHelpers');

process.on('message', ({ modulePath, binaryPath, dotnetPath }) => {
  try {
    const msHelper = getMSHelper({ modulePath, binaryPath, dotnetPath });
    const version = msHelper.getDocxToHtmlsVersion();
    process.send({ version });
  } catch (error) {
    console.log('Error getting DOCX to HTMLs version:', error.message);
    process.send({ version: null, message: error.message });
  }
});

setInterval(() => {
  console.log('"Get Docx to HTMLs Version" still alive', Date.now());
}, 1e3);
