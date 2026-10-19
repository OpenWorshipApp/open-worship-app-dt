import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import { PDFDocument } from 'mupdf';
import { genPNGImages } from '../public/js/pdf-to-images.mjs';
import { countPDFPages } from '../public/js/count-pdf-pages.mjs';
import { genChatPageImages } from '../public/js/pdf-to-chat-images.mjs';

const tempDirs = [];

function runWorker(scriptName, data) {
  return new Promise((resolveResult, reject) => {
    const child = fork(new URL(`../public/js/${scriptName}`, import.meta.url), {
      execArgv: [],
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      callback(value);
    };
    const timeout = setTimeout(
      () => finish(reject, new Error(`${scriptName} timed out`)),
      5000,
    );
    child.once('message', (message) => finish(resolveResult, message));
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code) =>
      finish(reject, new Error(`${scriptName} exited with ${code}`)),
    );
    child.send(data);
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    if (resolve(dir).startsWith(resolve(tmpdir()) + sep)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('renders large and multi-page PDFs within preview pixel limits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'owa-pdf-preview-'));
  tempDirs.push(dir);
  const pdfPath = join(dir, 'large.pdf');
  const doc = new PDFDocument();
  try {
    for (const bounds of [
      [0, 0, 640, 480],
      [0, 0, 20000, 20000],
      ...Array.from({ length: 10 }, () => [0, 0, 640, 480]),
    ]) {
      const page = doc.addPage(bounds, 0, {}, '');
      doc.insertPage(-1, page);
      page.destroy();
    }
    doc.save(pdfPath);
  } finally {
    doc.destroy();
  }

  expect(countPDFPages(pdfPath)).toBe(12);

  const firstBatch = genPNGImages({
    filePath: pdfPath,
    outDir: dir,
    width: 10000,
    startPage: 0,
    endPage: 4,
  });
  const secondBatch = genPNGImages({
    filePath: pdfPath,
    outDir: dir,
    width: 10000,
    startPage: 4,
    endPage: 12,
  });
  const result = {
    isSuccessful: firstBatch.isSuccessful && secondBatch.isSuccessful,
    filePaths: [...firstBatch.filePaths, ...secondBatch.filePaths],
  };

  expect(firstBatch.pageCount).toBe(12);
  expect(secondBatch.pageCount).toBe(12);
  expect(result).toMatchObject({ isSuccessful: true });
  expect(result.filePaths).toHaveLength(12);
  const dimensions = result.filePaths.map((path) => {
    const png = readFileSync(path);
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  });
  expect(dimensions[0]).toEqual([640, 480]);
  expect(dimensions[1][0] * dimensions[1][1]).toBeLessThanOrEqual(8_000_000);
  expect(dimensions[1][0]).toBeGreaterThan(2000);
  expect(dimensions.slice(2)).toEqual(Array(10).fill([640, 480]));
});

test('count and rendering workers respond through their IPC channel', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'owa-pdf-worker-'));
  tempDirs.push(dir);
  const pdfPath = resolve('docs/pdf/hello-world.pdf');
  const count = await runWorker('count-pdf-pages.mjs', { filePath: pdfPath });
  expect(count).toBeGreaterThan(0);

  const result = await runWorker('pdf-to-images.mjs', {
    filePath: pdfPath,
    outDir: dir,
    width: 1920,
    startPage: 0,
    endPage: 1,
  });
  expect(result).toMatchObject({ isSuccessful: true, pageCount: count });
  expect(result.filePaths).toHaveLength(1);
  expect(readFileSync(result.filePaths[0]).subarray(1, 4).toString()).toBe(
    'PNG',
  );
});

// The help window's assistant reads a PDF as pictures of its pages
// (`pdf-to-chat-images.mjs`): the same 1024px long edge as any picture it
// is sent, as many pages as a question carries, and nothing on the disk.
test('renders chat pages in memory at the long edge a picture is sent at', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'owa-pdf-chat-'));
  tempDirs.push(dir);
  const pdfPath = join(dir, 'chapter.pdf');
  const doc = new PDFDocument();
  try {
    for (const bounds of [
      [0, 0, 612, 792],
      [0, 0, 792, 612],
      ...Array.from({ length: 10 }, () => [0, 0, 300, 400]),
    ]) {
      const page = doc.addPage(bounds, 0, {}, '');
      doc.insertPage(-1, page);
      page.destroy();
    }
    doc.save(pdfPath);
  } finally {
    doc.destroy();
  }

  const result = genChatPageImages({ filePath: pdfPath });
  expect(result).toMatchObject({
    isSuccessful: true,
    pageCount: 12,
    startPage: 0,
  });
  expect(result.pageTexts).toHaveLength(8);
  expect(result.pageTexts[0]).toEqual({ page: 1, text: '' });
  // Eight at most: each is re-sent on every round of every question.
  expect(result.dataUrls).toHaveLength(8);
  const dimensions = result.dataUrls.map((dataUrl) => {
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  });
  // Portrait, landscape, and a small page drawn UP to the same long edge.
  expect(Math.max(...dimensions[0])).toBe(1024);
  expect(dimensions[0][1]).toBe(1024);
  expect(dimensions[1][0]).toBe(1024);
  expect(Math.max(...dimensions[2])).toBe(1024);

  const later = genChatPageImages({
    filePath: pdfPath,
    startPage: 10,
    maxPages: 50,
  });
  expect(later).toMatchObject({ isSuccessful: true, startPage: 10 });
  expect(later.dataUrls).toHaveLength(2);
  expect(later.pageTexts.map((page) => page.page)).toEqual([11, 12]);

  const complete = genChatPageImages({
    filePath: pdfPath,
    allPages: true,
  });
  expect(complete.dataUrls).toHaveLength(12);
  expect(complete.pageTexts.map((page) => page.page)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);

  const detailed = genChatPageImages({
    filePath: pdfPath,
    maxPages: 1,
    longEdge: 2048,
  });
  const detailedPng = Buffer.from(detailed.dataUrls[0].split(',')[1], 'base64');
  expect(
    Math.max(detailedPng.readUInt32BE(16), detailedPng.readUInt32BE(20)),
  ).toBe(2048);

  expect(
    genChatPageImages({ filePath: join(dir, 'missing.pdf') }),
  ).toMatchObject({ isSuccessful: false });

  const viaWorker = await runWorker('pdf-to-chat-images.mjs', {
    filePath: resolve('docs/pdf/hello-world.pdf'),
    maxPages: 1,
  });
  expect(viaWorker).toMatchObject({ isSuccessful: true });
  expect(viaWorker.dataUrls).toHaveLength(1);
  expect(viaWorker.pageTexts[0].text).toContain('Hello, this is PDF content');
});
