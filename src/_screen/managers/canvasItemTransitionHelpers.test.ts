// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { CanvasItemTransitions } from './canvasItemTransitionHelpers';

function fixture(effects: (string | undefined)[]) {
    const slide = document.createElement('div');
    const content = document.createElement('div');
    slide.append(content);
    Object.defineProperty(content, 'offsetWidth', { value: 1000 });
    const nodes = effects.map((effect) => {
        const node = document.createElement('div');
        node.dataset.canvasItemUuid = crypto.randomUUID();
        if (effect !== undefined) node.dataset.canvasItemTransition = effect;
        node.style.transform = 'rotate(25deg)';
        node.style.left = '100px';
        node.style.opacity = '0.6';
        node.style.mixBlendMode = 'screen';
        const runs: {
            resolve: () => void;
            cancel: ReturnType<typeof vi.fn>;
        }[] = [];
        const animate = vi.fn(
            (_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
                let resolve!: () => void;
                let reject!: (reason?: unknown) => void;
                const finished = new Promise<void>((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                const cancel = vi.fn(() => reject(new Error('cancelled')));
                runs.push({ resolve, cancel });
                return { finished, cancel } as unknown as Animation;
            },
        );
        node.animate = animate;
        content.append(node);
        return { node, animate, runs };
    });
    return { slide, content, nodes, transitions: new CanvasItemTransitions() };
}

describe('canvas item transitions', () => {
    test('keeps whole slide transitions when no item has an override', () => {
        const { transitions, slide, content, nodes } = fixture([
            undefined,
            'bad',
        ]);
        expect(transitions.enter(slide, content, 'fade', () => 500)).toBe(
            false,
        );
        expect(transitions.has(slide)).toBe(false);
        expect(nodes[0].animate).not.toHaveBeenCalled();
    });

    test('animates overrides and inherited siblings independently while preserving authored styles', async () => {
        const { transitions, slide, content, nodes } = fixture([
            'none',
            'move',
            'zoom',
            undefined,
        ]);
        expect(transitions.enter(slide, content, 'fade', () => 500)).toBe(true);
        expect(nodes[0].animate).not.toHaveBeenCalled();
        expect(nodes[1].animate.mock.calls[0]).toEqual([
            [{ translate: '-1000px 0px' }, { translate: '0px 0px' }],
            { duration: 500, easing: 'ease-in-out', fill: 'both' },
        ]);
        expect(nodes[2].animate.mock.calls[0]?.[0]).toEqual([
            { opacity: 0, scale: '0.1' },
            { opacity: '0.6', scale: '1' },
        ]);
        expect(nodes[3].animate.mock.calls[0]?.[0]).toEqual([
            { opacity: 0 },
            { opacity: '0.6' },
        ]);
        for (const { node, runs } of nodes) {
            expect(node.parentElement).toBe(content);
            expect(node.style.transform).toBe('rotate(25deg)');
            expect(node.style.left).toBe('100px');
            expect(node.style.mixBlendMode).toBe('screen');
            runs[0]?.resolve();
        }
        await Promise.resolve();
        expect(nodes[1].runs[0].cancel).toHaveBeenCalledOnce();
        const exit = transitions.exit(slide);
        expect(nodes[0].node.style.visibility).toBe('hidden');
        for (const { runs } of nodes) runs[1]?.resolve();
        await exit;
        expect(transitions.has(slide)).toBe(false);
    });

    test('interrupts entrance, deduplicates exit and releases animations on unmount', async () => {
        const { transitions, slide, content, nodes } = fixture(['move']);
        transitions.enter(slide, content, 'fade', () => 500);
        const exit = transitions.exit(slide);
        expect(transitions.exit(slide)).toBe(exit);
        expect(nodes[0].runs[0].cancel).toHaveBeenCalledOnce();
        expect(nodes[0].animate).toHaveBeenCalledTimes(2);
        transitions.dispose();
        await exit;
        expect(nodes[0].runs[1].cancel).toHaveBeenCalled();
        expect(transitions.has(slide)).toBe(false);
    });

    test('ignores canvas markers nested in user HTML', () => {
        const { transitions, slide, content, nodes } = fixture([undefined]);
        const nested = document.createElement('div');
        nested.dataset.canvasItemUuid = crypto.randomUUID();
        nested.dataset.canvasItemTransition = 'zoom';
        nodes[0].node.append(nested);
        expect(transitions.enter(slide, content, 'fade', () => 500)).toBe(
            false,
        );
    });
});
