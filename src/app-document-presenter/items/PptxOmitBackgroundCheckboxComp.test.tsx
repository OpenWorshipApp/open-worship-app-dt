// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    choices: new Map<string, boolean>(),
    log: [] as string[],
    getMock: vi.fn(),
    setMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
// The real `appHooks`, so the choice is read the way the app reads it: it
// picks its effect hook by `isDev` when it loads.
vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../server/pptxBuildOptionHelpers', () => ({
    getPptxOmitBackground: h.getMock,
    setPptxOmitBackground: h.setMock,
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            fireUpdateEvent: () => {
                h.log.push(`update ${filePath}`);
            },
        }),
    },
}));

import PptxOmitBackgroundCheckboxComp from './PptxOmitBackgroundCheckboxComp';

let container: HTMLDivElement;
let root: Root;

async function render(filePath: string) {
    await act(async () => {
        root.render(
            createElement(PptxOmitBackgroundCheckboxComp, { filePath }),
        );
    });
}

function getBox() {
    return container.querySelector<HTMLInputElement>('input[type=checkbox]')!;
}

describe('Omit Background', () => {
    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.choices.clear();
        h.log = [];
        h.getMock.mockReset();
        h.setMock.mockReset();
        h.getMock.mockImplementation(async (filePath: string) => {
            return h.choices.get(filePath) ?? true;
        });
        h.setMock.mockImplementation(
            async (filePath: string, isOmit: boolean) => {
                h.log.push(`set ${filePath} ${isOmit}`);
                h.choices.set(filePath, isOmit);
            },
        );
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('is ticked for a deck with no choice of its own, under its label', async () => {
        await render('/documents/a.pptx');
        expect(getBox().checked).toBe(true);
        expect(container.textContent).toBe('Omit Background');
        expect(h.getMock).toHaveBeenCalledWith('/documents/a.pptx');
    });

    test("shows a deck's own unticked choice", async () => {
        h.choices.set('/documents/b.pptx', false);
        await render('/documents/b.pptx');
        expect(getBox().checked).toBe(false);
    });

    test('unticking keeps the choice, then tells the deck so its slides are rebuilt', async () => {
        await render('/documents/a.pptx');
        await act(async () => getBox().click());

        expect(getBox().checked).toBe(false);
        expect(h.log).toEqual([
            'set /documents/a.pptx false',
            'update /documents/a.pptx',
        ]);

        await act(async () => getBox().click());
        expect(getBox().checked).toBe(true);
        expect(h.log.slice(2)).toEqual([
            'set /documents/a.pptx true',
            'update /documents/a.pptx',
        ]);
    });

    test('follows the deck picked next', async () => {
        h.choices.set('/documents/b.pptx', false);
        await render('/documents/a.pptx');
        expect(getBox().checked).toBe(true);
        await render('/documents/b.pptx');
        expect(getBox().checked).toBe(false);
        await act(async () => getBox().click());
        expect(h.log).toEqual([
            'set /documents/b.pptx true',
            'update /documents/b.pptx',
        ]);
    });
});
