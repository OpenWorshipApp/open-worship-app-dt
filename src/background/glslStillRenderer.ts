import {
    createGlslProgram,
    deleteGlslProgram,
    drawGlslFrame,
    getGlslContext,
    GLSL_NO_WEBGL_ERROR,
    toGlslColorArray,
    type GlslProgramType,
} from '../_screen/glslAnimationRuntime';
import {
    ANIMATION_SPEED_FACTOR_MAP,
    ANIMATION_STILL_TIME_SECONDS,
    type GlslAnimationType,
} from './animationValueHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';

/**
 * A shader's STILL picture, for everywhere it does not move: a tile in the
 * Animations tab, a presenter's Mini Screen. One hidden WebGL canvas draws
 * every one of them, each copied out onto the asker's own small 2D canvas --
 * a browser keeps only a few WebGL contexts at once, and a dozen tiles each
 * holding one would push out the projector's. The shared one is let go of
 * once nothing has been drawn for a while: kept, it would hold graphics
 * memory for nothing.
 *
 * Drawn one per task, so opening the tab with a dozen shaders to compile
 * never holds the presenter for all of them at once. A compiled shader is
 * kept beside the shared context and goes with it: a category's samples
 * recolour the same twenty effects (the colours are uniforms), so switching
 * category compiles nothing again -- which is why the cap is above twenty,
 * a few more for a person's own; never more than `MAX_KEPT_PROGRAM_COUNT`.
 */

const RELEASE_AFTER_MS = 10000;

const MAX_KEPT_PROGRAM_COUNT = 24;

type SharedType = {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    // By code, oldest first.
    programMap: Map<string, GlslProgramType>;
};
let shared: SharedType | null = null;
let releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;

function getShared() {
    if (shared !== null && !shared.gl.isContextLost()) {
        return shared;
    }
    shared = null;
    const canvas = document.createElement('canvas');
    const gl = getGlslContext(canvas);
    if (gl === null) {
        return null;
    }
    shared = { canvas, gl, programMap: new Map() };
    return shared;
}

function scheduleRelease() {
    if (releaseTimeoutId !== null) {
        clearTimeout(releaseTimeoutId);
    }
    releaseTimeoutId = setTimeout(() => {
        releaseTimeoutId = null;
        // Losing the context frees every program made on it.
        shared?.gl.getExtension('WEBGL_lose_context')?.loseContext();
        shared = null;
    }, RELEASE_AFTER_MS);
}

function getProgram(current: SharedType, code: string) {
    const kept = current.programMap.get(code);
    if (kept !== undefined) {
        current.programMap.delete(code);
        current.programMap.set(code, kept);
        return kept;
    }
    const glslProgram = createGlslProgram(current.gl, code);
    if ('error' in glslProgram) {
        return glslProgram;
    }
    current.programMap.set(code, glslProgram);
    for (const [oldCode, oldProgram] of current.programMap) {
        if (current.programMap.size <= MAX_KEPT_PROGRAM_COUNT) {
            break;
        }
        current.programMap.delete(oldCode);
        deleteGlslProgram(current.gl, oldProgram);
    }
    return glslProgram;
}

/**
 * Draw `animation`'s still onto `target` (a 2D canvas sized by the caller).
 * False when it cannot: no WebGL here, or the shader does not compile -- the
 * caller keeps what it drew under it.
 */
export function drawGlslStill(
    animation: GlslAnimationType,
    target: HTMLCanvasElement,
): boolean {
    const context2d = target.getContext('2d');
    const current = getShared();
    if (context2d === null || current === null) {
        return false;
    }
    const { canvas, gl } = current;
    canvas.width = target.width;
    canvas.height = target.height;
    const glslProgram = getProgram(current, genGlslAnimationCode(animation));
    scheduleRelease();
    if ('error' in glslProgram) {
        return false;
    }
    drawGlslFrame(gl, glslProgram, {
        time:
            ANIMATION_STILL_TIME_SECONDS *
            ANIMATION_SPEED_FACTOR_MAP[animation.speed],
        colors: toGlslColorArray(animation.colors),
        colorCount: animation.colors.length,
    });
    // Copied out in the same task, before the drawing buffer is cleared.
    context2d.clearRect(0, 0, target.width, target.height);
    context2d.drawImage(canvas, 0, 0);
    return true;
}

type QueueItemType = {
    animation: GlslAnimationType;
    target: HTMLCanvasElement;
    onDone: (isDrawn: boolean) => void;
};
const queue: QueueItemType[] = [];
let isQueueRunning = false;

function runQueue() {
    const item = queue.shift();
    if (item === undefined) {
        isQueueRunning = false;
        return;
    }
    let isDrawn: boolean;
    try {
        isDrawn = drawGlslStill(item.animation, item.target);
    } catch {
        isDrawn = false;
    }
    item.onDone(isDrawn);
    setTimeout(runQueue, 0);
}

/** `drawGlslStill` in turn; the returned function takes it out of the line. */
export function queueGlslStill(
    animation: GlslAnimationType,
    target: HTMLCanvasElement,
    onDone: (isDrawn: boolean) => void = () => {},
): () => void {
    const item = { animation, target, onDone };
    queue.push(item);
    if (!isQueueRunning) {
        isQueueRunning = true;
        setTimeout(runQueue, 0);
    }
    return () => {
        const index = queue.indexOf(item);
        if (index >= 0) {
            queue.splice(index, 1);
        }
    };
}

/**
 * Whether a person's code compiles, for the code editor: null when it does,
 * else the driver's log with the lines numbered as they see them.
 */
export function checkGlslCodeCompiles(code: string): string | null {
    const current = getShared();
    if (current === null) {
        return GLSL_NO_WEBGL_ERROR;
    }
    const glslProgram = createGlslProgram(current.gl, code);
    scheduleRelease();
    if ('error' in glslProgram) {
        return glslProgram.error;
    }
    deleteGlslProgram(current.gl, glslProgram);
    return null;
}
