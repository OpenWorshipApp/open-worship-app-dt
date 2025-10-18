import appProvider from './appProvider';

export function pathToFileURL(filePath: string) {
    return appProvider.browserUtils.pathToFileURL(filePath);
}

export function toBase64(str: string) {
    return Buffer.from(str, 'utf-8').toString('base64');
}
export function fromBase64(str: string) {
    return Buffer.from(str, 'base64').toString('utf-8');
}
