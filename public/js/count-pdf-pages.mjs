'use strict';
/* eslint-disable */

import { openPdfFile } from './pdf-stream.mjs';
import { basename } from 'node:path';

export function countPDFPages(filePath) {
  let pdf;
  try {
    pdf = openPdfFile(filePath);
    return pdf.document.countPages();
  } catch (error) {
    console.log('Error counting PDF pages:', error.message);
    return null;
  } finally {
    pdf?.close();
  }
}

if (process.send && basename(process.argv[1] ?? '') === 'count-pdf-pages.mjs') {
  process.on('message', ({ filePath }) => {
    process.send(countPDFPages(filePath));
  });
}
