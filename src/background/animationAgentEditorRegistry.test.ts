import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    findAnimationAgentUndoEditorId,
    genAnimationAgentEditorId,
    listAnimationAgentEditors,
    onAnimationAgentEditorsChanged,
    pushAnimationAgentUndo,
    registerAnimationAgentCode,
    registerAnimationAgentEditor,
    takeAnimationAgentUndo,
    touchAnimationAgentEditor,
    type AnimationAgentCodeHandleType,
    type AnimationAgentEditorHandleType,
} from './animationAgentEditorRegistry';

const cleanupList: (() => void)[] = [];

function genHandle(
    id: string,
    src = 'css?name=aurora',
): AnimationAgentEditorHandleType {
    return {
        id,
        place: 'background',
        screenId: 0,
        getDraftSrc: () => src,
        setDraftSrc: () => true,
        openCode: () => false,
    };
}

function register(handle: AnimationAgentEditorHandleType) {
    const unregister = registerAnimationAgentEditor(handle);
    cleanupList.push(unregister);
    return unregister;
}

function genCodeHandle(): AnimationAgentCodeHandleType {
    return {
        engine: 'glsl',
        getCode: () => 'code',
        setCode: () => {},
        checkCode: () => null,
        apply: () => true,
    };
}

afterEach(() => {
    while (cleanupList.length > 0) {
        cleanupList.pop()?.();
    }
});

describe('genAnimationAgentEditorId', () => {
    it('names an editor by its place and screen', () => {
        expect(genAnimationAgentEditorId('background', 2)).toBe('background:2');
        expect(genAnimationAgentEditorId('foreground', null)).toBe(
            'foreground:none',
        );
    });
});

describe('the open editors', () => {
    it('lists the one opened or touched last first, and forgets one gone', () => {
        register(genHandle('background:0'));
        const unregister = register(genHandle('foreground:0'));
        expect(
            listAnimationAgentEditors().map((one) => {
                return one.id;
            }),
        ).toEqual(['foreground:0', 'background:0']);
        touchAnimationAgentEditor('background:0');
        expect(listAnimationAgentEditors()[0].id).toBe('background:0');
        unregister();
        expect(
            listAnimationAgentEditors().map((one) => {
                return one.id;
            }),
        ).toEqual(['background:0']);
    });

    it('leaves a newer handle of the same editor in place', () => {
        const unregisterOld = register(genHandle('background:0', 'old'));
        register(genHandle('background:0', 'new'));
        unregisterOld();
        expect(listAnimationAgentEditors()[0].getDraftSrc()).toBe('new');
    });

    it('puts the code panel on its editor and takes it off again', () => {
        register(genHandle('background:0'));
        const code = genCodeHandle();
        const unregisterCode = registerAnimationAgentCode('background:0', code);
        expect(listAnimationAgentEditors()[0].code).toBe(code);
        unregisterCode();
        expect(listAnimationAgentEditors()[0].code).toBeNull();
        // No editor: nothing is held for it.
        registerAnimationAgentCode('nobody:0', code)();
        expect(listAnimationAgentEditors()).toHaveLength(1);
    });

    it('tells a listener when an editor comes or goes', () => {
        const listener = vi.fn();
        const stop = onAnimationAgentEditorsChanged(listener);
        const unregister = register(genHandle('background:0'));
        unregister();
        stop();
        register(genHandle('background:1'));
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('the undo list', () => {
    it('takes a change back with every change after it', () => {
        register(genHandle('background:0'));
        const first = pushAnimationAgentUndo('background:0', {
            src: 'one',
            code: null,
        });
        const second = pushAnimationAgentUndo('background:0', {
            src: 'two',
            code: 'code two',
        });
        expect(first).not.toBe(second);
        expect(findAnimationAgentUndoEditorId(String(second))).toBe(
            'background:0',
        );
        const taken = takeAnimationAgentUndo('background:0', first);
        // The code typed after the change named goes back too.
        expect(taken).toEqual({
            undo: { id: first, src: 'one', code: 'code two' },
            laterCount: 1,
        });
        expect(takeAnimationAgentUndo('background:0', second)).toBeNull();
        expect(findAnimationAgentUndoEditorId(String(second))).toBeNull();
    });

    it('puts back the code from before the FIRST code change taken', () => {
        register(genHandle('background:0'));
        const colors = pushAnimationAgentUndo('background:0', {
            src: 'ripples',
            code: null,
        });
        pushAnimationAgentUndo('background:0', {
            src: 'slow ripples',
            code: 'ripples code',
        });
        pushAnimationAgentUndo('background:0', {
            src: 'slow ripples',
            code: 'waves code',
        });
        expect(takeAnimationAgentUndo('background:0', colors)).toEqual({
            undo: { id: colors, src: 'ripples', code: 'ripples code' },
            laterCount: 2,
        });
    });

    it('takes the newest with no id, and keeps ten at most', () => {
        register(genHandle('background:0'));
        const idList = Array.from({ length: 12 }, (_, index) => {
            return pushAnimationAgentUndo('background:0', {
                src: `src ${index}`,
                code: null,
            });
        });
        expect(findAnimationAgentUndoEditorId(String(idList[1]))).toBeNull();
        expect(takeAnimationAgentUndo('background:0', null)).toEqual({
            undo: { id: idList[11], src: 'src 11', code: null },
            laterCount: 0,
        });
    });

    it('holds nothing for an editor that is not open', () => {
        expect(
            pushAnimationAgentUndo('nobody:0', { src: null, code: null }),
        ).toBeNull();
        expect(takeAnimationAgentUndo('nobody:0', null)).toBeNull();
    });

    it('goes with its editor', () => {
        const unregister = register(genHandle('background:0'));
        const id = pushAnimationAgentUndo('background:0', {
            src: 'one',
            code: null,
        });
        unregister();
        register(genHandle('background:0'));
        expect(takeAnimationAgentUndo('background:0', id)).toBeNull();
    });
});
