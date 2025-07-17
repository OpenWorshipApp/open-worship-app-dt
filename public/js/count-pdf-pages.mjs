'use strict';
/* eslint-disable */

import { readFileSync } from 'node:fs';
import { PDFDocument } from 'mupdf';

process.on('message', ({ filePath }) => {
  try {
    console.log(`Counting PDF pages for ${filePath}`);
    const doc = PDFDocument.openDocument(
      readFileSync(filePath),
      'application/pdf',
    );
    const count = doc.countPages();
    process.send(count);
  } catch (error) {
    console.log('Error counting PDF pages:', error.message);
    process.send(null);
  }
});

setInterval(() => {
  console.log('"Count PDF pages" still alive', Date.now());
}, 1e3);
