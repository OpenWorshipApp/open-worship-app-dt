'use strict';
/* eslint-disable */

import { writeFileSync, existsSync, lstatSync, unlinkSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { ColorSpace, Matrix, emptyStore } from 'mupdf';
import { openPdfFile } from './pdf-stream.mjs';

// A preview only needs screen-sized pixels. Large page boxes can otherwise
// exhaust MuPDF's WASM heap before the first PNG is written.
const MAX_PIXELS = 8_000_000;
const MAX_SIDE = 8192;
const DEFAULT_WIDTH = 1920;

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

function getPixmap(page, requestedWidth) {
  const [x0, y0, x1, y1] = page.getBounds();
  const pageWidth = Math.abs(x1 - x0);
  const pageHeight = Math.abs(y1 - y0);
  if (
    !Number.isFinite(pageWidth * pageHeight) ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    throw new Error('Invalid PDF page dimensions');
  }
  const screenWidth =
    Number.isFinite(requestedWidth) && requestedWidth > 0
      ? requestedWidth
      : DEFAULT_WIDTH;
  const scale = Math.min(
    1,
    screenWidth / pageWidth,
    (MAX_SIDE - 2) / pageWidth,
    (MAX_SIDE - 2) / pageHeight,
    // MuPDF rounds the transformed bounds outward to whole pixels.
    Math.sqrt(MAX_PIXELS / (pageWidth * pageHeight)) * 0.995,
  );
  return page.toPixmap(
    Matrix.scale(scale, scale),
    ColorSpace.DeviceRGB,
    true,
    true,
  );
}

export function genPNGImages({
  filePath,
  outDir,
  width,
  startPage = 0,
  endPage,
}) {
  const filePaths = [];
  let pdf;
  try {
    pdf = openPdfFile(filePath);
    const doc = pdf.document;
    const count = doc.countPages();
    if (
      !Number.isInteger(startPage) ||
      startPage < 0 ||
      (endPage !== undefined &&
        (!Number.isInteger(endPage) || endPage < startPage))
    ) {
      throw new Error('Invalid PDF page range');
    }
    for (let i = startPage; i < Math.min(count, endPage ?? count); i++) {
      const page = doc.loadPage(i);
      try {
        const pixmap = getPixmap(page, width);
        try {
          const imagePath = resolve(outDir, `page-${i}.png`);
          forceRemoveFile(imagePath);
          filePaths.push(imagePath);
          writeFileSync(imagePath, pixmap.asPNG());
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
        // Decoded images and fonts are cached in MuPDF's WASM heap. A long
        // document should not retain those resources from previous pages.
        emptyStore();
      }
    }
    return {
      isSuccessful: true,
      filePaths,
      pageCount: count,
    };
  } catch (error) {
    for (const filePath of filePaths) {
      forceRemoveFile(filePath);
    }
    return {
      isSuccessful: false,
      message: error.message,
    };
  } finally {
    pdf?.close();
  }
}

if (process.send && basename(process.argv[1] ?? '') === 'pdf-to-images.mjs') {
  process.on('message', (data) => {
    process.send(genPNGImages(data));
  });
}
