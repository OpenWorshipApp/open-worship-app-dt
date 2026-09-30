import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { PDFDocument, Stream } from 'mupdf';

// MuPDF can request ranges from a file as needed. Reading the entire PDF into
// a Buffer first duplicates large files in both Node and the WASM heap.
export function openPdfFile(filePath) {
  const descriptor = openSync(filePath, 'r');
  let stream;
  try {
    const fileSize = fstatSync(descriptor).size;
    stream = new Stream({
      fileSize: () => fileSize,
      read: (memory, offset, length, position) =>
        readSync(descriptor, memory, offset, length, position),
      close: () => closeSync(descriptor),
    });
    const document = PDFDocument.openDocument(stream, 'application/pdf');
    return {
      document,
      close() {
        try {
          document.destroy();
        } finally {
          stream.destroy();
        }
      },
    };
  } catch (error) {
    if (stream) {
      stream.destroy();
    } else {
      closeSync(descriptor);
    }
    throw error;
  }
}
