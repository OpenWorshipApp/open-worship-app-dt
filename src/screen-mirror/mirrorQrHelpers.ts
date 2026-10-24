// Reads the text of a QR code in a picture -- a host address someone sent as
// an image. The decoder is loaded on the first read, never with the page.

// Large enough for a phone photo of a screen, small enough that a low-spec
// machine decodes it in a moment; a full-size retry follows only if the
// downscaled try finds nothing.
const FIRST_SIDE = 1200;
const SECOND_SIDE = 2400;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

export async function readQrTextFromImage(file: Blob) {
    if (!file.type.startsWith('image/') || file.size > MAX_FILE_BYTES) {
        return null;
    }
    const [{ default: jsQR }, bitmap] = await Promise.all([
        import('jsqr'),
        createImageBitmap(file),
    ]);
    try {
        for (const side of [FIRST_SIDE, SECOND_SIDE]) {
            const scale = Math.min(
                1,
                side / Math.max(bitmap.width, bitmap.height),
            );
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = new OffscreenCanvas(width, height);
            const context = canvas.getContext('2d', {
                willReadFrequently: true,
            });
            if (context === null) {
                return null;
            }
            context.drawImage(bitmap, 0, 0, width, height);
            const { data } = context.getImageData(0, 0, width, height);
            const code = jsQR(data, width, height, {
                inversionAttempts: 'attemptBoth',
            });
            if (code?.data) {
                return code.data;
            }
            if (scale === 1) {
                break;
            }
        }
        return null;
    } finally {
        bitmap.close();
    }
}

export function findImageFile(items: DataTransferItemList | undefined) {
    for (const item of Array.from(items ?? [])) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            return item.getAsFile();
        }
    }
    return null;
}
