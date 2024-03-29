import path from 'node:path';
import fs from 'node:fs';
const pdfjsLib = require('pdfjs-dist/build/pdf');

const ext = '.pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.js';

function toPdf(filePath: string, outputDir: string) {
    return new Promise<void>((resolve, reject) => {
        const { convert } = require('libreoffice-convert');
        const fileName = path.basename(filePath);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File ${filePath} not found`);
        }
        if (!fs.existsSync(outputDir) ||
            !fs.lstatSync(outputDir).isDirectory()) {
            throw new Error(`Directory ${outputDir} does not exist`);
        }
        const outputPath = path.join(outputDir, `${fileName}${ext}`);
        if (fs.existsSync(outputPath)) {
            throw new Error(`PDF file ${outputPath} already exists`);
        }
        const docxBuf = fs.readFileSync(filePath);
        convert(docxBuf, ext, undefined, (err: any, result: any) => {
            if (err) {
                return reject(err);
            }
            fs.writeFileSync(outputPath, result);
            resolve();
        });
    });
}

export default {
    toPdf,
    pdfjsLib,
};
