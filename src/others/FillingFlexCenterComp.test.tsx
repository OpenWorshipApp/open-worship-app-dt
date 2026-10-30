// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import FillingFlexCenterComp from './FillingFlexCenterComp';

let host: HTMLDivElement;
let root: Root;

function setBodyWidth(width: number) {
    Object.defineProperty(document.body, 'clientWidth', {
        configurable: true,
        value: width,
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    delete (document.body as any).clientWidth;
    vi.unstubAllGlobals();
});

describe('FillingFlexCenterComp', () => {
    test('adds enough invisible spacers to fill one row of the window', async () => {
        setBodyWidth(1000);
        await act(async () =>
            root.render(
                <FillingFlexCenterComp
                    width={300}
                    className="filler"
                    style={{ margin: '2px' }}
                />,
            ),
        );
        const spacers = Array.from(
            host.querySelectorAll<HTMLDivElement>('.filler'),
        );
        expect(spacers).toHaveLength(4);
        expect(spacers[0].style.width).toBe('300px');
        expect(spacers[0].style.height).toBe('0px');
        expect(spacers[0].style.visibility).toBe('hidden');
        expect(spacers[0].style.pointerEvents).toBe('none');
        expect(spacers[0].style.margin).toBe('2px');
    });

    test('a zero width still yields a sane number of spacers', async () => {
        setBodyWidth(800);
        await act(async () =>
            root.render(<FillingFlexCenterComp width={0} className="filler" />),
        );
        expect(host.querySelectorAll('.filler')).toHaveLength(2);
    });

    test('a new width recounts the spacers', async () => {
        setBodyWidth(1000);
        await act(async () =>
            root.render(
                <FillingFlexCenterComp width={500} className="filler" />,
            ),
        );
        expect(host.querySelectorAll('.filler')).toHaveLength(3);
        await act(async () =>
            root.render(
                <FillingFlexCenterComp width={100} className="filler" />,
            ),
        );
        expect(host.querySelectorAll('.filler')).toHaveLength(11);
    });
});
