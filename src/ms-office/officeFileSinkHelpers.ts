import { fsCreateWriteStream } from '../server/fileHelpers';

// A file an Office package is streamed into, one finished ZIP entry at a time
// (`OfficeZipWriter`): a `.pptx`'s or a `.docx`'s pictures go to disk as each
// is made, so the whole package is never held in memory. `abort` leaves a
// partial file for the caller to delete.
export function createOfficeFileSink(filePath: string) {
    const stream = fsCreateWriteStream(filePath);
    let streamError: Error | null = null;
    stream.on('error', (error) => {
        streamError = error;
    });
    return {
        write: (chunk: Uint8Array) => {
            return new Promise<void>((resolve, reject) => {
                if (streamError !== null) {
                    reject(streamError);
                    return;
                }
                // one entry per call and each awaited: backpressure for free
                stream.write(chunk, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        },
        close: () => {
            return new Promise<void>((resolve, reject) => {
                if (streamError !== null) {
                    reject(streamError);
                    return;
                }
                stream.once('error', reject);
                stream.end(() => {
                    resolve();
                });
            });
        },
        abort: () => {
            stream.destroy();
        },
    };
}
