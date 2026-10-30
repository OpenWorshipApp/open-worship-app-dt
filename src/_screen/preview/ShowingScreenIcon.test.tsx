// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./screenIdColorHelpers', () => ({
    genColorFromScreenId: (screenId: number) => {
        return screenId === 2 ? 'rgb(10, 20, 30)' : 'rgb(0, 0, 0)';
    },
}));

import ShowingScreenIconComp, {
    genColorFromScreenId,
} from './ShowingScreenIcon';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ShowingScreenIconComp', () => {
    test('re-exports the screen colour from its leaf module', () => {
        expect(genColorFromScreenId(2)).toBe('rgb(10, 20, 30)');
    });

    test('a plain badge names the screen and is not clickable', async () => {
        await act(async () => {
            root.render(<ShowingScreenIconComp screenId={2} />);
        });
        const badge = container.querySelector<HTMLElement>('[data-screen-id]')!;
        expect(badge.dataset.screenId).toBe('2');
        expect(badge.title).toBe('Screen: 2');
        expect(badge.className).not.toContain('app-caught-hover-pointer');
        expect(badge.textContent).toBe('2');
        const icon = badge.querySelector<HTMLElement>('i')!;
        expect(icon.dataset.screenIconId).toBe('2');
        expect(icon.style.color).toBe('rgb(10, 20, 30)');
    });

    test('a clickable badge reports its screen id with the event', async () => {
        const onClick = vi.fn();
        await act(async () => {
            root.render(
                <ShowingScreenIconComp
                    screenId={4}
                    title="Show on screen 4"
                    onClick={onClick}
                />,
            );
        });
        const badge = container.querySelector<HTMLElement>('[data-screen-id]')!;
        expect(badge.title).toBe('Show on screen 4');
        expect(badge.className).toContain('app-caught-hover-pointer');
        await act(async () => {
            badge.click();
        });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1]).toBe(4);
        expect(onClick.mock.calls[0][0].type).toBe('click');
    });
});
