import { beforeEach, describe, expect, test } from 'vitest';

describe('agentDebugHelpers', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'location', {
            value: {
                href: 'https://localhost:3000/presenter.html',
            },
            configurable: true,
        });
        Object.defineProperty(globalThis, 'document', {
            value: {
                title: 'Presenter',
            },
            configurable: true,
        });
        delete (globalThis as any).__OPEN_WORSHIP_AGENT_DEBUG__;
    });

    test('collects registered data and provider output', async () => {
        const {
            initAgentDebugBridge,
            registerAgentDebugProvider,
            setAgentDebugData,
        } = await import('./agentDebugHelpers');

        initAgentDebugBridge();
        setAgentDebugData('selection', {
            count: 2,
        });
        registerAgentDebugProvider('page', () => {
            return {
                route: 'presenter',
                selectedSlideId: 3,
            };
        });
        const snapshot = await (
            globalThis as any
        ).__OPEN_WORSHIP_AGENT_DEBUG__.getSnapshot();

        expect(snapshot.title).toBe('Presenter');
        expect(snapshot.locationHref).toBe(
            'https://localhost:3000/presenter.html',
        );
        expect(snapshot.registeredData.selection).toEqual({
            count: 2,
        });
        expect(snapshot.providerData.page).toEqual({
            route: 'presenter',
            selectedSlideId: 3,
        });
    });
});
