// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        dirPath: '/data/videos',
        dirSettingNames: [] as string[],
        fireRefreshEvent: vi.fn(),
        options: null as null | {
            width: number;
            height: number;
            seconds: number;
            frameRate: number;
        },
        toasts: [] as { title: string; message: unknown }[],
        files: new Map<string, Uint8Array>(),
        moves: [] as [string, string][],
        deleted: [] as string[],
        patches: [] as { path: string; start: number; bytes: Uint8Array }[],
        sinkChunks: [] as Uint8Array[],
        sinkAborted: false,
        source: {
            drawVideoFrame: vi.fn(),
            toPngBytes: vi.fn(async () => Uint8Array.of(137, 80, 78, 71)),
            close: vi.fn(),
        },
        sourceOptions: [] as unknown[],
        encoded: [] as { timestamp: number; keyFrame: boolean }[],
        isSupported: true,
        onFrame: null as null | ((index: number) => void),
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
}));
vi.mock('../helper/DirSource', () => ({
    default: {
        getInstance: async (settingName: string) => {
            h.dirSettingNames.push(settingName);
            return {
                dirPath: h.dirPath,
                fireRefreshEvent: h.fireRefreshEvent,
            };
        },
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        fileUtils: {
            createWriteStream: (path: string, { start }: { start: number }) => {
                return {
                    once: vi.fn(),
                    end: (bytes: Uint8Array, done: () => void) => {
                        h.patches.push({ path, start, bytes });
                        done();
                    },
                };
            },
        },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (path: string) => {
        return h.files.has(path) || path.endsWith('.part');
    },
    fsDeleteFile: async (path: string) => {
        h.deleted.push(path);
    },
    fsMove: async (from: string, to: string) => {
        h.moves.push([from, to]);
    },
    fsWriteFile: async (path: string, data: Uint8Array) => {
        h.files.set(path, new Uint8Array(data));
        return path;
    },
    pathBasename: vi.fn(),
    pathJoin: vi.fn(),
}));
vi.mock('../ms-office/officeFileSinkHelpers', () => ({
    createOfficeFileSink: () => ({
        write: async (chunk: Uint8Array) => {
            h.sinkChunks.push(chunk.slice());
        },
        close: async () => undefined,
        abort: () => {
            h.sinkAborted = true;
        },
    }),
}));
vi.mock('../resources/resourcesCopyHelpers', () => ({
    genFreeFilePath: async (dirPath: string, name: string) => {
        return `${dirPath}/${name}`;
    },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: (title: string, message: unknown) => {
        h.toasts.push({ title, message });
    },
    createSimpleToastUpdater: () => {
        return (title: string, message: unknown) => {
            h.toasts.push({ title, message });
        };
    },
}));
vi.mock('./AnimationExportDialogComp', () => ({
    askAnimationExportOptions: async () => h.options,
}));
vi.mock('./animationExportFrameSources', () => ({
    createAnimationFrameSource: async (
        _animation: unknown,
        options: unknown,
    ) => {
        h.sourceOptions.push(options);
        return h.source;
    },
}));
vi.mock('./animationLabelHelpers', () => ({
    genAnimationLabel: () => 'Glass',
}));

import { exportAnimation } from './animationExportHelpers';
import { listAnimationCategorySrcs } from './animationBuiltInHelpers';

const SRC = listAnimationCategorySrcs('christmas', 'glsl')[0];

class FakeVideoEncoder {
    static async isConfigSupported(config: VideoEncoderConfig) {
        return { supported: h.isSupported, config };
    }
    state = 'unconfigured';
    encodeQueueSize = 0;
    private index = 0;
    constructor(
        private readonly init: {
            output: (chunk: any, metadata?: any) => void;
            error: (error: Error) => void;
        },
    ) {}
    configure() {
        this.state = 'configured';
    }
    encode(frame: { timestamp: number }, options: { keyFrame: boolean }) {
        h.encoded.push({
            timestamp: frame.timestamp,
            keyFrame: options.keyFrame,
        });
        const isFirst = this.index === 0;
        this.index += 1;
        this.init.output(
            {
                type: options.keyFrame ? 'key' : 'delta',
                byteLength: 3,
                copyTo: (target: Uint8Array) => {
                    target.set([7, 8, 9]);
                },
            },
            isFirst
                ? { decoderConfig: { description: Uint8Array.of(1, 100) } }
                : undefined,
        );
    }
    async flush() {}
    close() {
        this.state = 'closed';
    }
    addEventListener() {}
    removeEventListener() {}
}

type ProgressPropsType = {
    store: { getPercent: () => number; isClosed: boolean };
    onStop: () => void;
};

function listProgressToasts() {
    return h.toasts
        .map((toast) => toast.message)
        .filter(
            (message) => typeof message !== 'string',
        ) as ReactElement<ProgressPropsType>[];
}

function messageText(message: unknown) {
    return typeof message === 'string' ? message : 'progress';
}

beforeEach(() => {
    h.settings.clear();
    h.dirPath = '/data/videos';
    h.dirSettingNames = [];
    h.fireRefreshEvent.mockReset();
    h.options = { width: 1280, height: 720, seconds: 2, frameRate: 24 };
    h.toasts = [];
    h.files.clear();
    h.moves = [];
    h.deleted = [];
    h.patches = [];
    h.sinkChunks = [];
    h.sinkAborted = false;
    h.sourceOptions = [];
    h.encoded = [];
    h.isSupported = true;
    h.onFrame = null;
    h.source.close.mockReset();
    h.source.drawVideoFrame.mockReset();
    h.source.drawVideoFrame.mockImplementation(
        async (_wall: number, timestamp: number) => {
            h.onFrame?.(h.encoded.length);
            return { timestamp, close: vi.fn() };
        },
    );
    (globalThis as any).VideoEncoder = FakeVideoEncoder;
});

afterEach(() => {
    delete (globalThis as any).VideoEncoder;
});

describe('exportAnimation', () => {
    it('says so and asks nothing when the panel has no folder', async () => {
        h.dirPath = '';
        h.options = null;
        await exportAnimation({ src: SRC, place: 'foreground', kind: 'video' });
        expect(h.dirSettingNames).toEqual(['select-dir-video-fg']);
        expect(h.toasts.map((toast) => toast.message)).toEqual([
            'No videos folder is set yet',
        ]);
        expect(h.sourceOptions).toEqual([]);
    });

    it('writes nothing when the size is not chosen', async () => {
        h.options = null;
        await exportAnimation({ src: SRC, place: 'background', kind: 'image' });
        expect(h.files.size).toBe(0);
        expect(h.sourceOptions).toEqual([]);
    });

    it('saves a picture into the Images folder in use, see-through kept', async () => {
        h.dirPath = '/data/images';
        await exportAnimation({ src: SRC, place: 'background', kind: 'image' });
        expect(h.dirSettingNames).toEqual(['select-dir-image-bg']);
        expect(h.sourceOptions).toEqual([
            { width: 1280, height: 720, isTransparent: true },
        ]);
        expect([...h.files.keys()]).toEqual([
            '/data/images/Glass 1280x720.png',
        ]);
        expect([...h.files.get('/data/images/Glass 1280x720.png')!]).toEqual([
            137, 80, 78, 71,
        ]);
        expect(h.fireRefreshEvent).toHaveBeenCalled();
        expect(h.source.close).toHaveBeenCalled();
        expect(h.toasts.at(-1)?.message).toBe('Saved into your images');
        expect(JSON.parse(h.settings.get('animation-export-options')!)).toEqual(
            { width: 1280, height: 720, seconds: 2, frameRate: 24 },
        );
    });

    it('encodes every frame of a video, then names the file once whole', async () => {
        await exportAnimation({ src: SRC, place: 'background', kind: 'video' });
        expect(h.sourceOptions).toEqual([
            { width: 1280, height: 720, isTransparent: false },
        ]);
        // 2 s at 24 fps; a keyframe every 2 s.
        expect(h.encoded).toHaveLength(48);
        expect(h.encoded[0]).toEqual({ timestamp: 0, keyFrame: true });
        expect(h.encoded[24]).toEqual({
            timestamp: 1_000_000,
            keyFrame: false,
        });
        expect(
            h.encoded.filter((frame) => {
                return frame.keyFrame;
            }),
        ).toHaveLength(1);
        // Written: the head, each sample, then moov; its size patched in.
        const written = h.sinkChunks.reduce(
            (sum, chunk) => sum + chunk.length,
            0,
        );
        expect(
            h.sinkChunks.slice(1, 49).every((chunk) => chunk.length === 3),
        ).toBe(true);
        expect(h.patches).toHaveLength(1);
        expect(h.patches[0].path).toBe('/data/videos/Glass 1280x720.mp4.part');
        expect(written).toBeGreaterThan(48 * 3);
        expect(h.moves).toEqual([
            [
                '/data/videos/Glass 1280x720.mp4.part',
                '/data/videos/Glass 1280x720.mp4',
            ],
        ]);
        expect(h.fireRefreshEvent).toHaveBeenCalled();
        expect(h.source.close).toHaveBeenCalled();
        expect(messageText(h.toasts.at(-1)?.message)).toBe(
            'Saved into your videos',
        );
        // ONE progress toast, its number moved in place: a toast a percent
        // replayed the card's slide-in a hundred times -- it shook.
        const progressList = listProgressToasts();
        expect(progressList).toHaveLength(1);
        expect(progressList[0].props.store.getPercent()).toBe(100);
    });

    it('updates the percent inside the one card, and knows when it closed', async () => {
        h.options = { width: 1280, height: 720, seconds: 1, frameRate: 24 };
        let root: ReturnType<typeof createRoot> | null = null;
        const container = document.createElement('div');
        h.onFrame = (index) => {
            if (index === 0) {
                root = createRoot(container);
                act(() => {
                    root!.render(listProgressToasts()[0]);
                });
            }
        };
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        await act(async () => {
            await exportAnimation({
                src: SRC,
                place: 'background',
                kind: 'video',
            });
        });
        expect(container.textContent).toContain('Exporting 100%');
        const [progress] = listProgressToasts();
        expect(progress.props.store.isClosed).toBe(false);
        act(() => {
            root!.unmount();
        });
        expect(progress.props.store.isClosed).toBe(true);
    });

    it('puts the progress back up when it was closed mid-export', async () => {
        h.onFrame = (index) => {
            if (index === 10) {
                listProgressToasts()[0].props.store.isClosed = true;
            }
        };
        await exportAnimation({ src: SRC, place: 'background', kind: 'video' });
        expect(listProgressToasts()).toHaveLength(2);
        expect(h.toasts.at(-1)?.message).toBe('Saved into your videos');
    });

    it('stops when asked and leaves no part file behind', async () => {
        h.onFrame = (index) => {
            if (index === 10) {
                listProgressToasts().at(-1)!.props.onStop();
            }
        };
        await exportAnimation({ src: SRC, place: 'background', kind: 'video' });
        expect(h.encoded.length).toBeLessThan(48);
        expect(h.sinkAborted).toBe(true);
        expect(h.deleted).toEqual(['/data/videos/Glass 1280x720.mp4.part']);
        expect(h.moves).toEqual([]);
        expect(h.source.close).toHaveBeenCalled();
        expect(h.toasts.at(-1)?.message).toBe('Stopped');
    });

    it('says when this computer cannot encode the video', async () => {
        h.isSupported = false;
        await exportAnimation({ src: SRC, place: 'background', kind: 'video' });
        expect(h.encoded).toEqual([]);
        expect(h.deleted).toEqual(['/data/videos/Glass 1280x720.mp4.part']);
        expect(h.toasts.at(-1)?.message).toBe(
            'Cannot save this video: Video export is not supported on this computer',
        );
    });
});
