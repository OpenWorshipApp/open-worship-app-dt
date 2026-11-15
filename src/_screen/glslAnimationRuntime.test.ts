import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearLostGlslCodes,
    GLSL_NO_WEBGL_ERROR,
    startGlslAnimation,
    toGlslColorArray,
} from './glslAnimationRuntime';
import type { GlslAnimationType } from '../background/animationValueHelpers';
import {
    GLSL_HEADER_LINE_COUNT,
    toGlslCodeErrorLog,
} from '../background/glslAnimationSources';

/**
 * A WebGL context in name only: it records what was asked of it, and a
 * test says whether a shader compiles.
 */
function genFakeGl({ isCompiling = true } = {}) {
    const loseContext = vi.fn();
    const gl = {
        VERTEX_SHADER: 1,
        FRAGMENT_SHADER: 2,
        COMPILE_STATUS: 3,
        LINK_STATUS: 4,
        ARRAY_BUFFER: 5,
        STATIC_DRAW: 6,
        FLOAT: 7,
        TRIANGLES: 8,
        canvas: { width: 0, height: 0 },
        isLost: false,
        createShader: vi.fn((type: number) => ({ type })),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        // Only the person's half -- the fragment shader -- can fail.
        getShaderParameter: vi.fn((shader: { type: number }) => {
            return shader.type === 2 ? isCompiling : true;
        }),
        getShaderInfoLog: vi.fn(
            () => `ERROR: 0:${GLSL_HEADER_LINE_COUNT + 1}: 'x' : undeclared`,
        ),
        deleteShader: vi.fn(),
        createProgram: vi.fn(() => ({})),
        createBuffer: vi.fn(() => ({})),
        attachShader: vi.fn(),
        bindAttribLocation: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        getProgramInfoLog: vi.fn(() => ''),
        deleteProgram: vi.fn(),
        deleteBuffer: vi.fn(),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getUniformLocation: vi.fn((_program: unknown, name: string) => name),
        viewport: vi.fn(),
        useProgram: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        uniform3f: vi.fn(),
        uniform1f: vi.fn(),
        uniform4fv: vi.fn(),
        uniform1i: vi.fn(),
        drawArrays: vi.fn(),
        isContextLost: vi.fn(() => gl.isLost),
        getExtension: vi.fn((name: string) => {
            return name === 'WEBGL_lose_context' ? { loseContext } : null;
        }),
    };
    return { gl, loseContext };
}

function genFakeCanvas(gl: unknown) {
    const listeners = new Map<string, () => void>();
    const canvas = {
        width: 300,
        height: 150,
        getContext: vi.fn(() => gl),
        addEventListener: vi.fn((name: string, listener: () => void) => {
            listeners.set(name, listener);
        }),
        removeEventListener: vi.fn((name: string) => {
            listeners.delete(name);
        }),
    };
    if (gl !== null) {
        (gl as { canvas: unknown }).canvas = canvas;
    }
    return { canvas, listeners };
}

const animation: GlslAnimationType = {
    engine: 'glsl',
    name: 'plasma',
    code: null,
    colors: ['#000000', '#FF8000', '#FFFFFF80'],
    speed: 'normal',
    quality: 'normal',
    opacity: 100,
    blend: 'normal',
};

let frameCallbacks: Array<(now: number) => void>;
let resizeCallbacks: Array<
    (entries: { contentRect: { width: number; height: number } }[]) => void
>;
let disconnect: ReturnType<typeof vi.fn>;

function runFrame(now: number) {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    for (const callback of callbacks) {
        callback(now);
    }
}

function resizeTo(width: number, height: number) {
    for (const callback of resizeCallbacks) {
        callback([{ contentRect: { width, height } }]);
    }
}

beforeEach(() => {
    clearLostGlslCodes();
    frameCallbacks = [];
    resizeCallbacks = [];
    disconnect = vi.fn();
    vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((callback: (now: number) => void) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
        'ResizeObserver',
        class {
            constructor(callback: (typeof resizeCallbacks)[number]) {
                resizeCallbacks.push(callback);
            }
            observe() {}
            disconnect = disconnect;
        },
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('startGlslAnimation', () => {
    it('draws nothing before the canvas has a size, then a share of it', () => {
        const { gl } = genFakeGl();
        const { canvas } = genFakeCanvas(gl);
        const onFirstFrame = vi.fn();
        startGlslAnimation(canvas as any, animation, { onFirstFrame });
        runFrame(0);
        expect(gl.drawArrays).not.toHaveBeenCalled();
        expect(onFirstFrame).not.toHaveBeenCalled();
        resizeTo(1920, 1080);
        // Normal quality: half the pixels each way.
        expect(canvas.width).toBe(960);
        expect(canvas.height).toBe(540);
        expect(gl.drawArrays).toHaveBeenCalledTimes(1);
        expect(onFirstFrame).toHaveBeenCalledTimes(1);
        expect(gl.uniform4fv).toHaveBeenCalledWith(
            'uColors',
            expect.any(Float32Array),
        );
        expect(gl.uniform1i).toHaveBeenCalledWith('uColorCount', 3);
    });

    it('skips the frames between its rate, and stops for good', () => {
        const { gl, loseContext } = genFakeGl();
        const { canvas, listeners } = genFakeCanvas(gl);
        const run = startGlslAnimation(canvas as any, animation, { fps: 30 });
        resizeTo(100, 100);
        const drawn = gl.drawArrays.mock.calls.length;
        let now = performance.now();
        // Ten frames at 60 a second: five drawn at 30.
        for (let index = 0; index < 10; index++) {
            now += 1000 / 60;
            runFrame(now);
        }
        const count = gl.drawArrays.mock.calls.length - drawn;
        expect(count).toBeGreaterThanOrEqual(4);
        expect(count).toBeLessThanOrEqual(6);
        run.stop();
        run.stop();
        expect(disconnect).toHaveBeenCalled();
        expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
        expect(loseContext).toHaveBeenCalledTimes(1);
        expect(listeners.has('webglcontextlost')).toBe(false);
        const after = gl.drawArrays.mock.calls.length;
        runFrame(now + 1000);
        expect(gl.drawArrays.mock.calls.length).toBe(after);
    });

    it('says why when there is no WebGL, and holds nothing', () => {
        const { canvas } = genFakeCanvas(null);
        const onError = vi.fn();
        const run = startGlslAnimation(canvas as any, animation, { onError });
        expect(onError).toHaveBeenCalledWith(GLSL_NO_WEBGL_ERROR);
        expect(frameCallbacks).toEqual([]);
        expect(() => run.stop()).not.toThrow();
    });

    it('a shader that does not compile gives its context back at once', () => {
        const { gl, loseContext } = genFakeGl({ isCompiling: false });
        const { canvas } = genFakeCanvas(gl);
        const onError = vi.fn();
        startGlslAnimation(canvas as any, animation, { onError });
        expect(onError).toHaveBeenCalledWith(
            expect.stringContaining('ERROR: line 1:'),
        );
        expect(loseContext).toHaveBeenCalledTimes(1);
        expect(gl.drawArrays).not.toHaveBeenCalled();
    });

    it('a shader whose context the card took back is not started again here', () => {
        const { gl } = genFakeGl();
        const { canvas, listeners } = genFakeCanvas(gl);
        const onError = vi.fn();
        startGlslAnimation(canvas as any, animation, { onError });
        resizeTo(100, 100);
        gl.isLost = true;
        listeners.get('webglcontextlost')!();
        expect(onError).toHaveBeenCalledTimes(1);
        const again = genFakeGl();
        const second = genFakeCanvas(again.gl);
        const onSecondError = vi.fn();
        startGlslAnimation(second.canvas as any, animation, {
            onError: onSecondError,
        });
        expect(onSecondError).toHaveBeenCalledTimes(1);
        expect(second.canvas.getContext).not.toHaveBeenCalled();
        // Another shader still runs.
        const other = genFakeGl();
        const third = genFakeCanvas(other.gl);
        startGlslAnimation(third.canvas as any, { ...animation, name: 'flow' });
        expect(third.canvas.getContext).toHaveBeenCalled();
    });
});

describe('the helpers it hands the card', () => {
    it('four straight-alpha colours, the last repeated', () => {
        const values = Array.from(
            toGlslColorArray(['#000000', '#FF8000', '#FFFFFF80']),
        ).map((value) => {
            return Math.round(value * 255);
        });
        expect(values).toEqual([
            0, 0, 0, 255, 255, 128, 0, 255, 255, 255, 255, 128, 255, 255, 255,
            128,
        ]);
    });

    it('a driver’s log counts the lines a person sees', () => {
        expect(
            toGlslCodeErrorLog(
                `ERROR: 0:${GLSL_HEADER_LINE_COUNT + 3}: bad` +
                    String.fromCodePoint(0),
            ),
        ).toBe('ERROR: line 3: bad');
        // A line in the header itself is left as the driver said it.
        expect(toGlslCodeErrorLog('ERROR: 0:2: header')).toBe(
            'ERROR: 0:2: header',
        );
    });
});
