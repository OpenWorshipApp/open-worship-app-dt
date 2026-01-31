import { parse } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export function officeFileToPdf(officeFilePath: string, pdfFilePath: string) {
    return new Promise<Error | null>((resolve) => {
        try {
            mkdirSync(parse(pdfFilePath).dir, { recursive: true });
            const docxBuf = readFileSync(officeFilePath);
            const { convert } = require('libreoffice-convert');
            convert(docxBuf, 'pdf', undefined, (err: any, result: any) => {
                if (err) {
                    return resolve(new Error(err));
                }
                writeFileSync(pdfFilePath, result);
                resolve(null);
            });
        } catch (error) {
            resolve(error as Error);
        }
    });
}
