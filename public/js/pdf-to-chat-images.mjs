'use strict';
/* eslint-disable */

import { basename } from 'node:path';
import { ColorSpace, Matrix, emptyStore } from 'mupdf';
import { openPdfFile } from './pdf-stream.mjs';

// Pages of a PDF for the help window's assistant to READ, as pictures.
//
// Pictures rather than the text layer on purpose: a Khmer PDF is as often
// as not set in a legacy font whose "text" is Latin letters a font draws as
// Khmer, so the words pulled out of it are nonsense -- and a scan has no
// text at all. A picture is what the page LOOKS like, which is what the
// person is asking about.
//
// Handed back as bytes, never written to disk: nothing is left over for
// anybody to clean up, and the child process -- with MuPDF's whole WASM heap
// -- is gone as soon as it answers.

// The long edge every picture the help window sends is cut to
// (`MAX_IMAGE_EDGE` in `src/chatbot/attachmentHelpers.ts`): a provider bills
// a picture by its dimensions, so a bigger page buys no more reading.
const DEFAULT_LONG_EDGE = 1024;
const MAX_LONG_EDGE = 2048;
// Each page is re-sent on every round of every question about it.
const MAX_PAGES = 8;
// The same PNG-unless-photo-sized rule as a picture attached by hand: PNG
// keeps small text sharp, JPEG only once the PNG has come back photo-sized
// (a scanned page).
const MAX_PNG_BYTES = 900 * 1024;
const JPEG_QUALITY = 85;

function toWholeNumber(value, fallback, max) {
  return Number.isInteger(value) && value >= 0
    ? Math.min(value, max)
    : fallback;
}

function renderPage(page, longEdge) {
  const [x0, y0, x1, y1] = page.getBounds();
  const pageWidth = Math.abs(x1 - x0);
  const pageHeight = Math.abs(y1 - y0);
  const pageLongEdge = Math.max(pageWidth, pageHeight);
  if (!Number.isFinite(pageWidth * pageHeight) || pageLongEdge <= 0) {
    throw new Error('Invalid PDF page dimensions');
  }
  const scale = longEdge / pageLongEdge;
  // No alpha: a page with nothing painted behind its words is paper, and a
  // transparent background reads as black to more than one model.
  const pixmap = page.toPixmap(
    Matrix.scale(scale, scale),
    ColorSpace.DeviceRGB,
    false,
    true,
  );
  try {
    let bytes = pixmap.asPNG();
    let mediaType = 'image/png';
    if (bytes.length > MAX_PNG_BYTES) {
      bytes = pixmap.asJPEG(JPEG_QUALITY, false);
      mediaType = 'image/jpeg';
    }
    return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
  } finally {
    pixmap.destroy();
  }
}

// Keep the PDF's own text beside the picture when it has one. It is a useful
// exact transcript for ordinary Unicode PDFs, but never a replacement for the
// picture: scans have no text layer and legacy Khmer fonts can map unrelated
// Latin characters to the glyphs a reader sees.
function readPageText(page) {
  let structuredText;
  try {
    structuredText = page.toStructuredText('preserve-whitespace');
    return structuredText.asText();
  } catch (_error) {
    return null;
  } finally {
    structuredText?.destroy();
  }
}

export function genChatPageImages({
  filePath,
  startPage,
  maxPages,
  longEdge,
  allPages,
}) {
  let pdf;
  try {
    pdf = openPdfFile(filePath);
    const doc = pdf.document;
    const pageCount = doc.countPages();
    const firstPage = toWholeNumber(startPage, 0, pageCount);
    // Attachments keep the small default below. An MCP Resources read opts
    // into every remaining page so a chapter PDF reaches the assistant as
    // one complete resource instead of several conversational batches.
    const count =
      allPages === true
        ? Math.max(1, pageCount - firstPage)
        : Math.max(1, toWholeNumber(maxPages, MAX_PAGES, MAX_PAGES));
    const edge = Math.max(
      64,
      toWholeNumber(longEdge, DEFAULT_LONG_EDGE, MAX_LONG_EDGE),
    );
    const dataUrls = [];
    const pageTexts = [];
    for (let i = firstPage; i < Math.min(pageCount, firstPage + count); i++) {
      const page = doc.loadPage(i);
      try {
        pageTexts.push({ page: i + 1, text: readPageText(page) });
        dataUrls.push(renderPage(page, edge));
      } finally {
        page.destroy();
        // Fonts and images decoded for one page are no use to the next.
        emptyStore();
      }
    }
    return {
      isSuccessful: true,
      pageCount,
      startPage: firstPage,
      pageTexts,
      dataUrls,
    };
  } catch (error) {
    return { isSuccessful: false, message: error.message };
  } finally {
    pdf?.close();
  }
}

if (
  process.send &&
  basename(process.argv[1] ?? '') === 'pdf-to-chat-images.mjs'
) {
  process.on('message', (data) => {
    process.send(genChatPageImages(data ?? {}));
  });
}
