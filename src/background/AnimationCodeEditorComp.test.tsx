// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    parseAnimation,
    toAnimationSrc,
    type AnimationType,
    type GlslAnimationType,
} from './animationValueHelpers';
import { CSS_EFFECT_CODE_MAP } from './cssEffectCodeHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';
import AnimationCodeEditorComp from './AnimationCodeEditorComp';

type HookArgsType = {
    options: { value: string };
    onContentChange?: (oldContent: string, newContent: string) => void;
};

const h = vi.hoisted(() => ({
    value: '',
    // Each whole-text edit, in order, and the undo stops around them.
    edits: [] as string[],
    undoStops: 0,
    resets: [] as string[],
    compileCount: 0,
    onApply: vi.fn(),
    // Typing: the text changed, reported as Monaco reports a key press.
    type: (_code: string) => {},
}));

vi.mock('monaco-editor', () => ({
    Uri: { parse: (value: string) => ({ toString: () => value }) },
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({ children }: { children: any }) => children,
}));
vi.mock('./AnimationPreviewComp', () => ({
    default: ({ src }: { src: string }) => {
        return createElement('i', { 'data-preview': src });
    },
}));
vi.mock('./AnimationChatbotButtonComp', () => ({ default: () => null }));
vi.mock('./animationAgentEditorRegistry', () => ({
    registerAnimationAgentCode: () => () => {},
}));
vi.mock('../_screen/glslAnimationRuntime', () => ({
    GLSL_NO_WEBGL_ERROR: 'WebGL is not available.',
}));
// The graphics card's check, counted: a shader compiled twice for one
// change is the cost the panel must not pay.
vi.mock('./glslStillRenderer', () => ({
    checkGlslCodeCompiles: () => {
        h.compileCount += 1;
        return null;
    },
}));
// The real hook builds a Monaco editor; this one holds the text and
// reports a change the way Monaco's does, at once.
vi.mock('../helper/monacoEditorHelpers', async () => {
    const react = await import('react');
    return {
        useInitMonacoEditor: (args: HookArgsType) => {
            const editorStore = react.useMemo(() => {
                h.value = args.options.value;
                const setValue = (value: string) => {
                    h.value = value;
                    args.onContentChange?.('', value);
                };
                const editorInstance = {
                    getValue: () => h.value,
                    setValue,
                    getModel: () => ({
                        getFullModelRange: () => ({}),
                        dispose: () => {},
                    }),
                    pushUndoStop: () => {
                        h.undoStops += 1;
                    },
                    executeEdits: (_: string, edits: { text: string }[]) => {
                        h.edits.push(edits[0].text);
                        setValue(edits[0].text);
                        return true;
                    },
                };
                h.type = setValue;
                return { editorInstance };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return {
                editorStore,
                onContainerInit: () => () => {},
                setNewValue: (value: string) => {
                    h.resets.push(value);
                    editorStore.editorInstance.setValue(value);
                },
            };
        },
    };
});

const RAYS = parseAnimation(
    'css?name=rays&colors=0B1026-F59E0B-FDE68A&speed=normal&density=normal',
)!;
const PLASMA = parseAnimation(
    'glsl?name=plasma&colors=0F172A-7C3AED&speed=normal&quality=normal',
) as GlslAnimationType;

let container: HTMLDivElement;
let root: Root;

function render(animation: AnimationType) {
    act(() => {
        root.render(
            createElement(AnimationCodeEditorComp, {
                agentEditorId: 'background:0',
                animation,
                onApply: h.onApply,
                onClose: () => {},
            }),
        );
    });
}

function pressButton(text: string) {
    const button = [...document.body.querySelectorAll('button')].find((one) => {
        return one.textContent === text;
    });
    act(() => {
        button!.click();
    });
    return button!;
}

function typeCode(code: string) {
    act(() => {
        h.type(code);
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.value = '';
    h.edits = [];
    h.undoStops = 0;
    h.resets = [];
    h.compileCount = 0;
    h.onApply.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.useRealTimers();
});

describe('AnimationCodeEditorComp', () => {
    it('opens CSS Code on the effect picked, ready to apply', () => {
        // Reported: Light Rays picked, and CSS Code showed drifting lights.
        render(RAYS);
        expect(h.value).toBe(CSS_EFFECT_CODE_MAP.rays);
        expect(h.edits).toEqual([]);
        const preview = document.body.querySelector('[data-preview]');
        expect(preview?.getAttribute('data-preview')).toMatch(/^css\?code=/);
        pressButton('Apply');
        expect(h.onApply).toHaveBeenCalledWith(
            expect.objectContaining({
                engine: 'css',
                name: 'custom',
                code: CSS_EFFECT_CODE_MAP.rays,
                colors: RAYS.colors,
            }),
        );
    });

    it('follows another effect picked, as one edit Ctrl+Z takes back', () => {
        render(RAYS);
        render({ ...RAYS, name: 'snow' } as AnimationType);
        expect(h.edits).toEqual([CSS_EFFECT_CODE_MAP.snow]);
        // One stop before and one after: the edit is a step of its own.
        expect(h.undoStops).toBe(2);
        expect(h.value).toBe(CSS_EFFECT_CODE_MAP.snow);
    });

    it('keeps what was typed through a colour, speed or density', () => {
        render(RAYS);
        typeCode('.scene { opacity: 0.5; }');
        render({
            ...RAYS,
            colors: ['#000000', '#FFFFFF'],
            speed: 'fast',
            density: 'high',
        } as AnimationType);
        expect(h.edits).toEqual([]);
        expect(h.value).toBe('.scene { opacity: 0.5; }');
    });

    it('brings nothing in for its own Apply', () => {
        render(RAYS);
        pressButton('Apply');
        const applied = h.onApply.mock.calls[0][0] as AnimationType;
        // The picker hands the panel what was applied.
        render(parseAnimation(toAnimationSrc(applied))!);
        expect(h.edits).toEqual([]);
        expect(h.value).toBe(CSS_EFFECT_CODE_MAP.rays);
    });

    it('resets to the animation picked now', () => {
        render(RAYS);
        render({ ...RAYS, name: 'embers' } as AnimationType);
        typeCode('.scene {}');
        pressButton('Reset');
        expect(h.resets).toEqual([CSS_EFFECT_CODE_MAP.embers]);
        expect(h.value).toBe(CSS_EFFECT_CODE_MAP.embers);
    });

    it('follows a shader picked, compiling it once', () => {
        vi.useFakeTimers();
        render(PLASMA);
        expect(h.value).toBe(genGlslAnimationCode(PLASMA));
        const flames: GlslAnimationType = { ...PLASMA, name: 'flames' };
        const countBefore = h.compileCount;
        render(flames);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(h.edits).toEqual([genGlslAnimationCode(flames)]);
        // Checked at once; the check the edit started is dropped.
        expect(h.compileCount - countBefore).toBe(1);
    });
});
