// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getReactRoot } from './rootHelpers';

let alertMock: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    alertMock = vi.fn<(message: string) => void>();
    vi.stubGlobal('alert', alertMock);
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('getReactRoot', () => {
    test('empties the #root container and renders into it', async () => {
        const container = document.createElement('div');
        container.id = 'root';
        container.innerHTML = '<p>Loading the app…</p>';
        document.body.append(container);
        const root = getReactRoot();
        expect(container.innerHTML).toBe('');
        await act(async () => root.render(<main>ready</main>));
        expect(container.innerHTML).toBe('<main>ready</main>');
        await act(async () => root.unmount());
        expect(alertMock).not.toHaveBeenCalled();
    });

    test('can mount into a container of another id', async () => {
        const container = document.createElement('section');
        container.id = 'app-tools';
        document.body.append(container);
        const root = getReactRoot('app-tools');
        await act(async () => root.render(<span>tools</span>));
        expect(container.textContent).toBe('tools');
        await act(async () => root.unmount());
    });

    test('a missing container is said out loud, then thrown', () => {
        expect(() => getReactRoot('nowhere')).toThrow(
            'Root element not found: #nowhere',
        );
        expect(alertMock).toHaveBeenCalledExactlyOnceWith(
            'Root element not found: #nowhere',
        );
    });
});
