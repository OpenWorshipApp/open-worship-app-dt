// @vitest-environment jsdom

import { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';

const claimLayer = vi.hoisted(() => vi.fn());
vi.mock('../event/keyboardLayerHelpers', () => ({
    useKeyboardLayerClaim: claimLayer,
}));
vi.mock('../event/KeyboardEventListener', async () => {
    const { createContext } = await import('react');
    return { KeyboardLayerContext: createContext('root') };
});

import { KeyboardLayerContext } from '../event/KeyboardEventListener';
import PrimitiveModalComp, { POPUP_KEYBOARD_LAYER } from './PrimitiveModalComp';

function PresetInputComp() {
    const layer = useContext(KeyboardLayerContext);
    return <input aria-label="Preset name" data-layer={layer} />;
}

test('opens a blocking input inside fullscreen and keeps its popup keyboard layer', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const graph = document.createElement('div');
    document.body.append(host, graph);
    const root = createRoot(host);
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => graph,
    });
    try {
        await act(async () => {
            root.render(
                <PrimitiveModalComp>
                    <PresetInputComp />
                </PrimitiveModalComp>,
            );
        });
        expect(host.querySelector('#modal-container')).toBeNull();
        const modal = graph.querySelector('.modal-container--blocking');
        expect(modal).not.toBeNull();
        expect(claimLayer).toHaveBeenCalledWith(POPUP_KEYBOARD_LAYER);
        const input = modal?.querySelector('input');
        expect(input?.dataset.layer).toBe(POPUP_KEYBOARD_LAYER);
        input?.focus();
        expect(document.activeElement).toBe(input);
    } finally {
        await act(async () => root.unmount());
        expect(graph.childElementCount).toBe(0);
        Reflect.deleteProperty(document, 'fullscreenElement');
        host.remove();
        graph.remove();
    }
});
