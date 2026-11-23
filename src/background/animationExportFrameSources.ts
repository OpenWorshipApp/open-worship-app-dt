import {
    createGlslProgram,
    deleteGlslProgram,
    drawGlslFrame,
    getGlslContext,
    GLSL_NO_WEBGL_ERROR,
    toGlslColorArray,
} from '../_screen/glslAnimationRuntime';
import { electronSendAsync } from '../server/electronSendHelpers';
import { genCssAnimationHtml } from './cssAnimationLayerHelpers';
import { genCssCodeAnimationHtml } from './cssCodeAnimationHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';
import { toAnimationShaderTime } from './animationExportOptionHelpers';
import type {
    AnimationType,
    CssAnimationType,
    GlslAnimationType,
} from './animationValueHelpers';

/**
 * An animation drawn one frame at a time at a chosen size and moment, for
 * Save as Image / Save as Video (`animationExportHelpers`). Each moment is
 * asked for, never waited for: a slow computer takes longer to save, and
 * the video it saves is as smooth as a fast one's.
 *
 * - A shader is drawn here, on a canvas of its own the size asked
 *   (`drawGlslFrame` at its `iTime`), whatever its quality: quality is what
 *   a projector can afford live, and a file is drawn once.
 * - A CSS animation is markup, and no window can read its own markup's
 *   pixels: the main process draws Copy Code's page in a hidden window and
 *   pictures it (`electron/animationCaptureHelpers.ts`).
 *
 * A video frame is on black -- an MP4 has no see-through -- with the
 * animation's opacity over it, as a screen with nothing under it shows it;
 * a picture keeps what is see-through. `close()` gives everything back.
 */

export type AnimationFrameSourceType = {
    /** One frame of a video, `wallSeconds` into the animation as it runs. */
    drawVideoFrame: (
        wallSeconds: number,
        timestamp: number,
        duration: number,
    ) => Promise<VideoFrame>;
    /** A PNG of the moment `wallSeconds`. */
    toPngBytes: (wallSeconds: number) => Promise<Uint8Array>;
    close: () => void;
};

export type AnimationFrameSourceOptionsType = {
    width: number;
    height: number;
    /** A picture keeps see-through parts; a video does not. */
    isTransparent: boolean;
};

function createCanvas(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function createGlslFrameSource(
    animation: GlslAnimationType,
    { width, height }: AnimationFrameSourceOptionsType,
): AnimationFrameSourceType {
    const glCanvas = createCanvas(width, height);
    const gl = getGlslContext(glCanvas);
    if (gl === null) {
        throw new Error(GLSL_NO_WEBGL_ERROR);
    }
    const glslProgram = createGlslProgram(gl, genGlslAnimationCode(animation));
    if ('error' in glslProgram) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        throw new Error(glslProgram.error);
    }
    const colors = toGlslColorArray(animation.colors);
    const colorCount = animation.colors.length;
    const alpha = animation.opacity / 100;
    // Where a frame is laid down: the shader's drawing buffer is cleared
    // once the task ends, so it is copied out in the same task.
    const flatCanvas = createCanvas(width, height);
    const flatContext = flatCanvas.getContext('2d');
    if (flatContext === null) {
        deleteGlslProgram(gl, glslProgram);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        throw new Error('The picture could not be drawn.');
    }
    const draw = (wallSeconds: number, isTransparent: boolean) => {
        drawGlslFrame(gl, glslProgram, {
            time: toAnimationShaderTime(animation, wallSeconds),
            colors,
            colorCount,
        });
        flatContext.globalAlpha = 1;
        if (isTransparent) {
            flatContext.clearRect(0, 0, width, height);
        } else {
            flatContext.fillStyle = '#000000';
            flatContext.fillRect(0, 0, width, height);
        }
        flatContext.globalAlpha = alpha;
        flatContext.drawImage(glCanvas, 0, 0, width, height);
    };
    let isClosed = false;
    return {
        drawVideoFrame: async (wallSeconds, timestamp, duration) => {
            draw(wallSeconds, false);
            return new VideoFrame(flatCanvas, { timestamp, duration });
        },
        toPngBytes: async (wallSeconds) => {
            draw(wallSeconds, true);
            const blob = await new Promise<Blob | null>((resolve) => {
                flatCanvas.toBlob(resolve, 'image/png');
            });
            if (blob === null) {
                throw new Error('The picture could not be drawn.');
            }
            return new Uint8Array(await blob.arrayBuffer());
        },
        close: () => {
            if (isClosed) {
                return;
            }
            isClosed = true;
            if (!gl.isContextLost()) {
                deleteGlslProgram(gl, glslProgram);
                gl.getExtension('WEBGL_lose_context')?.loseContext();
            }
            // A 4K canvas is 33 MB; let it go now, not when collected.
            glCanvas.width = 0;
            glCanvas.height = 0;
            flatCanvas.width = 0;
            flatCanvas.height = 0;
        },
    };
}

type CapturedFrameType = { width: number; height: number; data: Uint8Array };

async function createCssFrameSource(
    animation: CssAnimationType,
    { width, height, isTransparent }: AnimationFrameSourceOptionsType,
): Promise<AnimationFrameSourceType> {
    const htmlText =
        animation.name === 'custom'
            ? genCssCodeAnimationHtml(animation)
            : genCssAnimationHtml(animation);
    const { captureId } = await electronSendAsync<{ captureId: string }>(
        'main:app:animation-capture-open',
        { htmlText, width, height, isTransparent },
    );
    const capture = (wallSeconds: number, kind: 'bitmap' | 'png') => {
        return electronSendAsync<CapturedFrameType>(
            'main:app:animation-capture-frame',
            {
                captureId,
                timeMilliseconds: Math.round(wallSeconds * 1000),
                kind,
            },
        );
    };
    let isClosed = false;
    return {
        drawVideoFrame: async (wallSeconds, timestamp, duration) => {
            const frame = await capture(wallSeconds, 'bitmap');
            return new VideoFrame(frame.data, {
                format: 'BGRA',
                codedWidth: frame.width,
                codedHeight: frame.height,
                timestamp,
                duration,
            });
        },
        toPngBytes: async (wallSeconds) => {
            return (await capture(wallSeconds, 'png')).data;
        },
        close: () => {
            if (isClosed) {
                return;
            }
            isClosed = true;
            electronSendAsync('main:app:animation-capture-close', {
                captureId,
            }).catch(() => undefined);
        },
    };
}

export async function createAnimationFrameSource(
    animation: AnimationType,
    options: AnimationFrameSourceOptionsType,
): Promise<AnimationFrameSourceType> {
    if (animation.engine === 'glsl') {
        return createGlslFrameSource(animation, options);
    }
    return createCssFrameSource(animation, options);
}
