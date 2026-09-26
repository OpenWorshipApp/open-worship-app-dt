import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import { PDFDocument } from 'mupdf';
import { genPNGImages } from '../public/js/pdf-to-images.mjs';
import { countPDFPages } from '../public/js/count-pdf-pages.mjs';

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
