import { afterAll, describe, expect, test, vi } from 'vitest';

// A dev build, decided when the module loads: that is when the console
// helper is installed, so this needs a module instance of its own.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => `tran:${value}`,
    setAppMenuItems: () => {},
    registerAppMenuClicked: () => () => {},
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: () => {} }));
vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
    useAppEffect: () => {},
}));
vi.mock('./canvasInsertActionHelpers', () => ({
    canvasInsertActionList: [
        {
            key: 'text',
            label: 'New',
            iconName: 'plus-square',
            handle: () => {},
        },
        {
            key: 'website',
            label: 'Insert Website',
            iconName: 'globe',
            handle: () => {},
        },
    ],
}));

import './canvasInsertAppMenuHelpers';

afterAll(() => {
    delete (globalThis as any).getCanvasInsertMenuItems;
});

describe('canvas Insert menu in a dev build', () => {
    test('is readable from the console, with the same labels and click data the native menu gets', () => {
        // The native menu is drawn by the OS, out of reach of CDP; this is
        // how QA and a developer reach the same commands.
        const getItems = (globalThis as any).getCanvasInsertMenuItems;
        expect(getItems).toBeTypeOf('function');
        expect(getItems()).toEqual([
            { label: 'tran:New', clickData: { canvasInsert: 'text' } },
            {
                label: 'tran:Insert Website',
                clickData: { canvasInsert: 'website' },
            },
        ]);
    });
});
