import { useSyncExternalStore } from 'react';

import DirSource from '../helper/DirSource';
import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsMove,
    fsWriteFile,
} from '../server/fileHelpers';
import { createOfficeFileSink } from '../ms-office/officeFileSinkHelpers';
import { genFreeFilePath } from '../resources/resourcesCopyHelpers';
import {
    createSimpleToastUpdater,
    showSimpleToast,
} from '../toast/toastHelpers';
import {
    Mp4FileWriter,
    type Mp4FilePatchType,
} from '../virtual-display/mp4FileWriter';
import type { AnimationAgentPlaceType } from './animationAgentEditorRegistry';
import { askAnimationExportOptions } from './AnimationExportDialogComp';
import {
    createAnimationFrameSource,
    type AnimationFrameSourceType,
} from './animationExportFrameSources';
import {
    genAnimationExportFileName,
    listAnimationExportCodecs,
    readAnimationExportOptions,
    saveAnimationExportOptions,
    toAnimationExportBitrate,
    toAnimationExportDirSettingName,
    toAnimationExportWallSeconds,
    type AnimationExportKindType,
    type AnimationExportOptionsType,
} from './animationExportOptionHelpers';
import { genAnimationLabel } from './animationLabelHelpers';
import {
    ANIMATION_STILL_TIME_SECONDS,
    parseAnimation,
    type AnimationType,
} from './animationValueHelpers';

/**
 * Save as Image / Save as Video on the Animations picker -- the Background
 * tab's and Animation Show's (2026-11-19, the user: _for animation add
 * button to save to image|video. for both background|foreground, for video
 * let user choose dimention and duration_, then _save to background image
 * (if active folder section available), same to video, same to foreground_).
 *
 * The file goes into the folder of the session in use in the panel it can
 * be presented from -- Images / Videos, or Image Show / Video Show -- so it
 * is there to put up the moment it is written; with no folder there, a toast
 * says so and nothing is written. One at a time (`AnimationExportButtonsComp`
 * holds the buttons while one runs): a weak church computer has one of
 * everything this uses.
 *
 * A video is H.264 in an MP4 (`Mp4FileWriter`), every frame drawn at its
 * moment (`animationExportFrameSources`) and written as it is encoded, so
 * nothing of the picture is held. It is written under `<name>.part` -- no
 * list shows a file half written -- and renamed when whole; stopped or
 * failed, the part is deleted.
 */

const KEYFRAME_SECONDS = 2;
const MAX_ENCODE_QUEUE = 4;
// The progress toast is put up once and stays until the outcome replaces it:
// a long export at 4K runs for minutes.
const PROGRESS_TOAST_MILLISECONDS = 6 * 60 * 60_000;

class AnimationExportStoppedError extends Error {}

function toTitle(kind: AnimationExportKindType) {
    return kind === 'image' ? tran('Save as image') : tran('Save as video');
}

async function resolveExportDirSource(
    place: AnimationAgentPlaceType,
    kind: AnimationExportKindType,
) {
    const dirSource = await DirSource.getInstance(
        toAnimationExportDirSettingName(place, kind),
    );
    if (!dirSource.dirPath) {
        showSimpleToast(
            toTitle(kind),
            kind === 'image'
                ? tran('No images folder is set yet')
                : tran('No videos folder is set yet'),
        );
        return null;
    }
    return dirSource;
}

async function exportImage(
    animation: AnimationType,
    dirSource: DirSource,
    options: AnimationExportOptionsType,
) {
    const source = await createAnimationFrameSource(animation, {
        width: options.width,
        height: options.height,
        isTransparent: true,
    });
    try {
        const bytes = await source.toPngBytes(ANIMATION_STILL_TIME_SECONDS);
        const filePath = await genFreeFilePath(
            dirSource.dirPath,
            genAnimationExportFileName(
                genAnimationLabel(animation),
                'image',
                options,
            ),
        );
        await fsWriteFile(filePath, Buffer.from(bytes));
        dirSource.fireRefreshEvent();
        showSimpleToast(tran('Save as image'), tran('Saved into your images'));
    } finally {
        source.close();
    }
}

async function pickEncoderConfig(options: AnimationExportOptionsType) {
    if (typeof VideoEncoder !== 'function') {
        return null;
    }
    for (const codec of listAnimationExportCodecs(
        options.width,
        options.height,
        options.frameRate,
    )) {
        const config: VideoEncoderConfig = {
            codec,
            width: options.width,
            height: options.height,
            bitrate: toAnimationExportBitrate(
                options.width,
                options.height,
                options.frameRate,
            ),
            framerate: options.frameRate,
            latencyMode: 'quality',
            avc: { format: 'avc' },
        } as VideoEncoderConfig;
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) {
                return config;
            }
        } catch {
            // Not this one: the next.
        }
    }
    return null;
}

function toBytes(source: AllowSharedBufferSource) {
    if (source instanceof ArrayBuffer) {
        return new Uint8Array(source.slice(0));
    }
    const view = source as ArrayBufferView;
    return new Uint8Array(
        view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
    );
}

/** Writes `patch.bytes` over the file at `patch.position`. */
function patchFile(filePath: string, patch: Mp4FilePatchType) {
    return new Promise<void>((resolve, reject) => {
        const stream = appProvider.fileUtils.createWriteStream(filePath, {
            flags: 'r+',
            start: patch.position,
        });
        stream.once('error', reject);
        stream.end(patch.bytes, () => {
            resolve();
        });
    });
}

function waitForEncodeQueue(encoder: VideoEncoder) {
    return new Promise<void>((resolve) => {
        const done = () => {
            clearTimeout(timer);
            encoder.removeEventListener('dequeue', done);
            resolve();
        };
        // A `dequeue` missed between the check and here waits no longer.
        const timer = setTimeout(done, 100);
        encoder.addEventListener('dequeue', done);
    });
}

/**
 * The percent a progress toast shows. The toast is put up ONCE and reads this
 * store: one toast a percent remounted it every time, and its slide-in ran
 * again a hundred times an export -- the card shook (2026-11-19, the user:
 * _it's shaking, look error on progress toast_). `isClosed` is set when the
 * card goes (its ✕, or the pointer leaving it), so the next percent brings it
 * back with its Stop.
 */
function createExportProgressStore() {
    let percent = 0;
    const listeners = new Set<() => void>();
    return {
        isClosed: false,
        getPercent: () => {
            return percent;
        },
        setPercent: (value: number) => {
            percent = value;
            for (const listener of listeners) {
                listener();
            }
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

type ExportProgressStoreType = ReturnType<typeof createExportProgressStore>;

function ExportProgressComp({
    store,
    onStop,
}: Readonly<{ store: ExportProgressStoreType; onStop: () => void }>) {
    const percent = useSyncExternalStore(store.subscribe, store.getPercent);
    useAppEffect(() => {
        store.isClosed = false;
        return () => {
            store.isClosed = true;
        };
    }, [store]);
    return (
        <span className="d-flex align-items-center gap-2">
            <span>
                {tran('Exporting')}{' '}
                <span className="animation-export-progress-percent">
                    {percent}%
                </span>
            </span>
            <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={onStop}
            >
                <i className="bi bi-stop-fill" aria-hidden="true" />{' '}
                {tran('Stop')}
            </button>
        </span>
    );
}

async function encodeVideo({
    source,
    options,
    writer,
    isStopped,
    onProgress,
}: {
    source: AnimationFrameSourceType;
    options: AnimationExportOptionsType;
    writer: Mp4FileWriter;
    isStopped: () => boolean;
    onProgress: (percent: number) => void;
}) {
    const config = await pickEncoderConfig(options);
    if (config === null) {
        throw new Error(tran('Video export is not supported on this computer'));
    }
    let avcC: Uint8Array | null = null;
    let encodeError: Error | null = null;
    let writing = Promise.resolve();
    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            const description = metadata?.decoderConfig?.description;
            if (avcC === null && description !== undefined) {
                avcC = toBytes(description);
            }
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            const isKey = chunk.type === 'key';
            writing = writing.then(() => {
                return writer.addSample(data, isKey);
            });
        },
        error: (error) => {
            encodeError = error;
        },
    });
    try {
        encoder.configure(config);
        const frameCount = Math.round(options.seconds * options.frameRate);
        const frameDuration = Math.round(1_000_000 / options.frameRate);
        const keyframeEvery = options.frameRate * KEYFRAME_SECONDS;
        let lastPercent = -1;
        for (let index = 0; index < frameCount; index++) {
            if (isStopped()) {
                throw new AnimationExportStoppedError();
            }
            if (encodeError !== null) {
                throw encodeError;
            }
            const frame = await source.drawVideoFrame(
                toAnimationExportWallSeconds(index, options.frameRate),
                Math.round((index * 1_000_000) / options.frameRate),
                frameDuration,
            );
            try {
                encoder.encode(frame, {
                    keyFrame: index % keyframeEvery === 0,
                });
            } finally {
                frame.close();
            }
            while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
                await waitForEncodeQueue(encoder);
            }
            // The disk keeps up, or the next frame waits for it.
            await writing;
            const percent = Math.floor(((index + 1) * 100) / frameCount);
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
        }
        await encoder.flush();
        await writing;
        if (encodeError !== null) {
            throw encodeError;
        }
    } finally {
        if (encoder.state !== 'closed') {
            encoder.close();
        }
    }
    if (avcC === null) {
        throw new Error(tran('Cannot save this video'));
    }
    return avcC as Uint8Array;
}

async function exportVideo(
    animation: AnimationType,
    dirSource: DirSource,
    options: AnimationExportOptionsType,
) {
    const title = tran('Save as video');
    const updateToast = createSimpleToastUpdater();
    let isStopRequested = false;
    const onStop = () => {
        isStopRequested = true;
    };
    const progressStore = createExportProgressStore();
    const putUpProgress = () => {
        updateToast(
            title,
            <ExportProgressComp store={progressStore} onStop={onStop} />,
            PROGRESS_TOAST_MILLISECONDS,
        );
    };
    const showProgress = (percent: number) => {
        progressStore.setPercent(percent);
        if (progressStore.isClosed) {
            progressStore.isClosed = false;
            putUpProgress();
        }
    };
    const fileName = genAnimationExportFileName(
        genAnimationLabel(animation),
        'video',
        options,
    );
    const partFilePath = `${await genFreeFilePath(dirSource.dirPath, fileName)}.part`;
    const sink = createOfficeFileSink(partFilePath);
    let source: AnimationFrameSourceType | null = null;
    putUpProgress();
    try {
        source = await createAnimationFrameSource(animation, {
            width: options.width,
            height: options.height,
            isTransparent: false,
        });
        const writer = new Mp4FileWriter(sink, {
            width: options.width,
            height: options.height,
            frameRate: options.frameRate,
        });
        await writer.start();
        const avcC = await encodeVideo({
            source,
            options,
            writer,
            isStopped: () => {
                return isStopRequested;
            },
            onProgress: showProgress,
        });
        const patch = await writer.finish(avcC);
        await sink.close();
        await patchFile(partFilePath, patch);
        // Named once whole: a file of that name may have come meanwhile.
        const filePath = await genFreeFilePath(dirSource.dirPath, fileName);
        await fsMove(partFilePath, filePath);
        dirSource.fireRefreshEvent();
        updateToast(title, tran('Saved into your videos'));
    } catch (error: any) {
        sink.abort();
        if (await fsCheckFileExist(partFilePath).catch(() => false)) {
            await fsDeleteFile(partFilePath).catch(() => undefined);
        }
        if (error instanceof AnimationExportStoppedError) {
            updateToast(title, tran('Stopped'));
            return;
        }
        updateToast(
            title,
            `${tran('Cannot save this video')}: ${String(error?.message ?? error)}`,
        );
    } finally {
        source?.close();
    }
}

/**
 * Asks for the size (and, for a video, how long and how smooth), then saves
 * the animation `src` into its panel's folder. Resolves once it is done.
 */
export async function exportAnimation({
    src,
    place,
    kind,
}: {
    src: string;
    place: AnimationAgentPlaceType;
    kind: AnimationExportKindType;
}) {
    const animation = parseAnimation(src);
    if (animation === null) {
        return;
    }
    // Asked first: there is no point choosing a size for nowhere.
    const dirSource = await resolveExportDirSource(place, kind);
    if (dirSource === null) {
        return;
    }
    const options = await askAnimationExportOptions(
        kind,
        readAnimationExportOptions(),
    );
    if (options === null) {
        return;
    }
    saveAnimationExportOptions(options);
    try {
        if (kind === 'image') {
            await exportImage(animation, dirSource, options);
        } else {
            await exportVideo(animation, dirSource, options);
        }
    } catch (error: any) {
        showSimpleToast(
            toTitle(kind),
            `${
                kind === 'image'
                    ? tran('Cannot save this picture')
                    : tran('Cannot save this video')
            }: ${String(error?.message ?? error)}`,
        );
    }
}
