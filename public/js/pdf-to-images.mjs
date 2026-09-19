'use strict';
/* eslint-disable */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  lstatSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { ColorSpace, Matrix, PDFDocument } from 'mupdf';

function forceRemoveFile(filePath) {
  try {
    if (existsSync(filePath) && lstatSync(filePath).isFile()) {
      unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.log('Error removing file:', error.message);
  }
  return false;
}

function getPixmap(page) {
  const pixmap = page.toPixmap(
    Matrix.identity,
    ColorSpace.DeviceRGB,
    true,
    true,
  );
  return pixmap;
}

function genPNGImages({ filePath, outDir, width }) {
  const filePaths = [];
  try {
    const doc = PDFDocument.openDocument(
      readFileSync(filePath),
      'application/pdf',
    );
    const count = doc.countPages();
    for (let i = 0; i < count; i++) {
      const page = doc.loadPage(i);
      const pixmap = getPixmap(page);
      const pageHeight = pixmap.getHeight();
      const pageWidth = pixmap.getWidth();
      const scale = width / pageWidth;
      const actualHeight = Math.round(pageHeight * scale);
      pixmap.setResolution(width, actualHeight);
      const pngImage = pixmap.asPNG();
      const filePath = resolve(outDir, `page-${i}.png`);
      forceRemoveFile(filePath);
      writeFileSync(filePath, pngImage);
      filePaths.push(filePath);
    }
    return {
      isSuccessful: true,
      filePaths,
    };
  } catch (error) {
    for (const filePath of filePaths) {
      forceRemoveFile(filePath);
    }
    return {
      isSuccessful: false,
      message: error.message,
    };
  }
}

process.on('message', ({ type, ...data }) => {
  console.log('pdf-to-images.mjs: PDF Data', data);
  const result = genPNGImages(data);
  process.send(result);
});

setInterval(() => {
  console.log('"PDF to Images" still alive', Date.now());
}, 1e3);
