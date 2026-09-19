import { describe, expect, test, vi } from 'vitest';

const { BaseCanvasItemMock, canvasItemErrorFromJsonErrorMock } = vi.hoisted(
    () => {
        class BaseCanvasItemMock<T extends { id: number; type: string }> {
            props: T;

            constructor(props: T) {
                this.props = { ...props };
            }

            static validate(json: any) {
                if (
                    typeof json.id !== 'number' ||
                    typeof json.type !== 'string'
                ) {
                    throw new TypeError('Invalid canvas item data');
                }
            }

            toJson() {
                return this.props;
            }
        }
        return {
            BaseCanvasItemMock,
            canvasItemErrorFromJsonErrorMock: vi.fn((json: any) => ({
                type: 'error',
                json,
            })),
        };
    },
);

vi.mock('./CanvasItem', () => ({
    default: BaseCanvasItemMock,
    CanvasItemError: {
        fromJsonError: canvasItemErrorFromJsonErrorMock,
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

// Keep the real canvasHelpers, but stub its only value import so the module
// graph does not pull in appProvider (which needs a DOM).
vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
}));

import CanvasItemYouTube from './CanvasItemYouTube';

describe('CanvasItemYouTube.toEmbedUrl', () => {
    test('converts the common YouTube URL forms into an embed URL', () => {
        const cases: [string, string][] = [
            [
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            [
                'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            [
                'https://youtu.be/dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            [
                'https://www.youtube.com/shorts/dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            [
                'https://www.youtube.com/live/dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            [
                'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
            // Already an embed URL — a video id is extracted and normalized.
            [
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1',
            ],
        ];
        for (const [input, expected] of cases) {
            expect(CanvasItemYouTube.toEmbedUrl(input)).toBe(expected);
        }
    });

    test('returns the original URL when no video id can be extracted', () => {
        expect(CanvasItemYouTube.toEmbedUrl('https://example.com/page')).toBe(
            'https://example.com/page',
        );
        expect(CanvasItemYouTube.toEmbedUrl('not a url')).toBe('not a url');
    });

    test('builds a 16:9 item at the recommended embed size centered on the point', () => {
        const item = CanvasItemYouTube.genFromUrl(
            400,
            300,
            'https://youtu.be/dQw4w9WgXcQ',
        );
        expect(item.toJson()).toEqual(
            expect.objectContaining({
                type: 'youtube',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                width: 560,
                height: 315,
                // Centered on (400, 300): left = 400 - 560/2, top = 300 - 315/2.
                left: 120,
                top: 300 - 315 / 2,
            }),
        );
        expect(item.shouldLockAspectRatio).toBe(true);
    });
});
