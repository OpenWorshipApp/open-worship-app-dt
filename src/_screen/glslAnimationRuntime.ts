import {
    ANIMATION_SPEED_FACTOR_MAP,
    GLSL_QUALITY_PLAN_MAP,
    type GlslAnimationType,
} from '../background/animationValueHelpers';
import {
    assembleGlslFragmentSource,
    genGlslAnimationCode,
    GLSL_VERTEX_SOURCE,
    toGlslCodeErrorLog,
} from '../background/glslAnimationSources';
import type { AppColorType } from '../others/color/colorValueHelpers';

/**
 * Runs a GLSL animation on a canvas (`glslAnimationSources` holds the code).
 * Loaded only when a shader is drawn -- a dynamic `import()` from the screen's
 * background (`ScreenBackgroundComp`) -- so no window pays for WebGL until it
 * shows one.
 *
 * What keeps an old church computer able to carry it:
 * - WebGL 1, one triangle covering the canvas, no textures, no depth.
 * - A share of the screen's pixels and a frame rate set by the animation's
 *   quality (`GLSL_QUALITY_PLAN_MAP`); the canvas is stretched to fill the
 *   rest, and frames in between are skipped, not drawn.
 * - `low-power`: a laptop with two graphics cards keeps the quiet one.
 * - Every failure stops it, and the caller keeps the still gradient it put
 *   under the canvas: no WebGL, a shader that will not compile, a context the
 *   graphics card took back. One taken back is not started again in this
 *   window -- a shader that hangs the card would otherwise hang it again and
 *   again, every window with it.
 */

const WEBGL_OPTIONS: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
};

/** Why nothing is drawn on a machine with no WebGL; a window can say it. */
export const GLSL_NO_WEBGL_ERROR = 'WebGL is not available.';

// A day of seconds, then round again: past it a float's step is too coarse.
const TIME_WRAP_SECONDS = 86400;
// The code of shaders whose context the graphics card took back here.
const lostCodeSet = new Set<string>();
const MAX_LOST_CODE_COUNT = 20;

export type GlslProgramType = {
    program: WebGLProgram;
    buffer: WebGLBuffer;
    resolutionLocation: WebGLUniformLocation | null;
    timeLocation: WebGLUniformLocation | null;
    colorsLocation: WebGLUniformLocation | null;
    colorCountLocation: WebGLUniformLocation | null;
};

export function getGlslContext(canvas: HTMLCanvasElement) {
    try {
        return canvas.getContext(
            'webgl',
            WEBGL_OPTIONS,
        ) as WebGLRenderingContext | null;
    } catch {
        return null;
    }
}

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string,
): { shader: WebGLShader } | { error: string } {
    const shader = gl.createShader(type);
    if (shader === null) {
        return { error: 'The graphics card could not make a shader.' };
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? '';
        gl.deleteShader(shader);
        return {
            error: toGlslCodeErrorLog(log) || 'The shader did not compile.',
        };
    }
    return { shader };
}

/** The program for a person's (or a built-in's) `mainImage`, or why not. */
export function createGlslProgram(
    gl: WebGLRenderingContext,
    code: string,
): GlslProgramType | { error: string } {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, GLSL_VERTEX_SOURCE);
    if ('error' in vertex) {
        return vertex;
    }
    const fragment = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        assembleGlslFragmentSource(code),
    );
    if ('error' in fragment) {
        gl.deleteShader(vertex.shader);
        return fragment;
    }
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    if (program === null || buffer === null) {
        return { error: 'The graphics card could not make a program.' };
    }
    gl.attachShader(program, vertex.shader);
    gl.attachShader(program, fragment.shader);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    // Linked, the shaders are the program's: the separate copies can go.
    gl.deleteShader(vertex.shader);
    gl.deleteShader(fragment.shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) ?? '';
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
        return {
            error: toGlslCodeErrorLog(log) || 'The shader did not link.',
        };
    }
    // One triangle larger than the canvas covers every pixel of it.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
    );
    return {
        program,
        buffer,
        resolutionLocation: gl.getUniformLocation(program, 'iResolution'),
        timeLocation: gl.getUniformLocation(program, 'iTime'),
        colorsLocation: gl.getUniformLocation(program, 'uColors'),
        colorCountLocation: gl.getUniformLocation(program, 'uColorCount'),
    };
}

export function deleteGlslProgram(
    gl: WebGLRenderingContext,
    glslProgram: GlslProgramType,
) {
    gl.deleteProgram(glslProgram.program);
    gl.deleteBuffer(glslProgram.buffer);
}

/** Four straight-alpha colours, 0 to 1, the missing ones repeating the last. */
export function toGlslColorArray(colors: AppColorType[]) {
    const values = new Float32Array(16);
    for (let index = 0; index < 4; index++) {
        const color = colors[Math.min(index, colors.length - 1)];
        const hex = color.slice(1);
        const alphaHex = hex.length === 8 ? hex.slice(6, 8) : 'FF';
        [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6), alphaHex].forEach(
            (part, partIndex) => {
                values[index * 4 + partIndex] = Number.parseInt(part, 16) / 255;
            },
        );
    }
    return values;
}

export function drawGlslFrame(
    gl: WebGLRenderingContext,
    glslProgram: GlslProgramType,
    {
        time,
        colors,
        colorCount,
    }: { time: number; colors: Float32Array; colorCount: number },
) {
    const { width, height } = gl.canvas;
    gl.viewport(0, 0, width, height);
    gl.useProgram(glslProgram.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, glslProgram.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3f(glslProgram.resolutionLocation, width, height, 1);
    gl.uniform1f(glslProgram.timeLocation, time);
    gl.uniform4fv(glslProgram.colorsLocation, colors);
    gl.uniform1i(glslProgram.colorCountLocation, colorCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export type GlslRunOptionsType = {
    /** Overrides the quality's share of the canvas's own size. */
    scale?: number;
    /** Overrides the quality's frame rate. */
    fps?: number;
    /** The first frame is on the canvas: a fallback under it can go. */
    onFirstFrame?: () => void;
    /** It stopped on its own; English, for a log or the code editor. */
    onError?: (error: string) => void;
};

export type GlslRunType = { stop: () => void };

function sizeCanvas(
    canvas: HTMLCanvasElement,
    scale: number,
    boxWidth: number,
    boxHeight: number,
) {
    const width = Math.max(1, Math.round(boxWidth * scale));
    const height = Math.max(1, Math.round(boxHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
}

/**
 * Plays `animation` on `canvas` until `stop()`. The canvas is laid out by
 * the caller (it fills its box); this draws a share of its pixels.
 */
export function startGlslAnimation(
    canvas: HTMLCanvasElement,
    animation: GlslAnimationType,
    { scale, fps, onFirstFrame, onError }: GlslRunOptionsType = {},
): GlslRunType {
    const code = genGlslAnimationCode(animation);
    if (lostCodeSet.has(code)) {
        onError?.('The graphics card stopped this shader before.');
        return { stop: () => {} };
    }
    const gl = getGlslContext(canvas);
    if (gl === null) {
        onError?.(GLSL_NO_WEBGL_ERROR);
        return { stop: () => {} };
    }
    const glslProgram = createGlslProgram(gl, code);
    if ('error' in glslProgram) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        onError?.(glslProgram.error);
        return { stop: () => {} };
    }
    const plan = GLSL_QUALITY_PLAN_MAP[animation.quality];
    const pixelScale = scale ?? plan.scale;
    const frameMs = 1000 / (fps ?? plan.fps);
    const speedFactor = ANIMATION_SPEED_FACTOR_MAP[animation.speed];
    const colors = toGlslColorArray(animation.colors);
    const colorCount = animation.colors.length;
    let frameId: number | null = null;
    let startTime: number | null = null;
    let lastDrawTime = -Infinity;
    let isFirstFrame = true;
    let isStopped = false;
    // Nothing is drawn until the canvas is laid out: a background is built
    // before it is put in the page, and a frame drawn at no size would let
    // the gradient under it go for nothing.
    let hasSize = false;

    const draw = (now: number) => {
        startTime ??= now;
        const time =
            (((now - startTime) / 1000) * speedFactor) % TIME_WRAP_SECONDS;
        drawGlslFrame(gl, glslProgram, { time, colors, colorCount });
        lastDrawTime = now;
        if (isFirstFrame) {
            isFirstFrame = false;
            onFirstFrame?.();
        }
    };
    const tick = (now: number) => {
        frameId = null;
        if (isStopped) {
            return;
        }
        // A frame a little early still counts: rAF's clock jitters.
        if (hasSize && now - lastDrawTime >= frameMs - 2) {
            draw(now);
        }
        frameId = requestAnimationFrame(tick);
    };
    const resizeObserver = new ResizeObserver((entries) => {
        const box = entries.at(-1)?.contentRect;
        if (box === undefined || isStopped) {
            return;
        }
        hasSize = box.width > 0 && box.height > 0;
        if (hasSize) {
            sizeCanvas(canvas, pixelScale, box.width, box.height);
            draw(performance.now());
        }
    });
    const stop = () => {
        if (isStopped) {
            return;
        }
        isStopped = true;
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        resizeObserver.disconnect();
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        if (!gl.isContextLost()) {
            deleteGlslProgram(gl, glslProgram);
            // Handed back now rather than when the canvas is collected:
            // a browser keeps only a few of these at once.
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    };
    function handleContextLost() {
        if (isStopped) {
            return;
        }
        if (lostCodeSet.size >= MAX_LOST_CODE_COUNT) {
            lostCodeSet.clear();
        }
        lostCodeSet.add(code);
        isStopped = true;
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        resizeObserver.disconnect();
        onError?.('The graphics card stopped this shader.');
    }
    canvas.addEventListener('webglcontextlost', handleContextLost);
    resizeObserver.observe(canvas);
    frameId = requestAnimationFrame(tick);
    return { stop };
}

/** Forget which shaders lost their context: for tests. */
export function clearLostGlslCodes() {
    lostCodeSet.clear();
}
