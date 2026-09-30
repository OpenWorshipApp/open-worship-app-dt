// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { event: null as null | (() => void), calls: 0 },
    mocks: { getItems: vi.fn() },
}));

vi.mock('../helper/appHooks', () => ({
    useAppStateAsync: (loader: () => Promise<unknown>, deps: unknown[]) => {
        const [value, setValue] = useState<unknown>(null);
        useEffect(() => {
            void loader().then(setValue);
        }, deps);
        return [value];
    },
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: unknown, callback: () => void) => {
        state.event = callback;
    },
}));
vi.mock('./PresentingFlow', () => ({
    default: {
        getInstance: (path: string) => ({
            getItems: () => mocks.getItems(path, ++state.calls),
        }),
    },
}));

import { usePresentingFlowItems } from './presentingFlowItemsHelpers';

describe('usePresentingFlowItems', () => {
    test('loads the sheet and reloads it on its update event', async () => {
        mocks.getItems.mockImplementation(
            async (_path: string, call: number) => [`items-${call}`],
        );
        const seen: unknown[] = [];
        function Harness() {
            seen.push(usePresentingFlowItems('/run'));
            return null;
        }
        const root = createRoot(document.createElement('div'));
        await act(async () => root.render(<Harness />));
        await act(async () => {
            await Promise.resolve();
        });
        expect(seen.at(-1)).toEqual(['items-1']);
        await act(async () => state.event?.());
        await act(async () => {
            await Promise.resolve();
        });
        expect(seen.at(-1)).toEqual(['items-2']);
        await act(async () => root.unmount());
    });
});
