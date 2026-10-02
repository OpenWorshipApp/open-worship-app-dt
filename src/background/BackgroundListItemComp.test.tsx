// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { pressElementLikeButtonMock } = vi.hoisted(() => ({
    pressElementLikeButtonMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: pressElementLikeButtonMock,
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: () => null,
}));

import BackgroundListItemComp from './BackgroundListItemComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    pressElementLikeButtonMock.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root.render(
            <BackgroundListItemComp
                backgroundType="video"
                name="sunrise.mp4"
                title="/media/sunrise.mp4"
                selectedCN=""
                src="file:///media/sunrise.mp4"
                isDraggable
                selectedBackgroundSrcList={[]}
                onContextMenu={() => {}}
                onClick={() => {}}
                colorNoteChild={<button type="button">note</button>}
            />,
        );
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

function pressEnterOn(element: Element) {
    act(() => {
        element.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
    });
}

describe('BackgroundListItemComp', () => {
    // A div you could only click: no keyboard reached a file, and nothing
    // but its caption named it.
    test('is a named tab stop', () => {
        const row = host.querySelector('.app-background-list-item');

        expect(row?.getAttribute('role')).toBe('button');
        expect(row?.getAttribute('tabindex')).toBe('0');
        expect(row?.getAttribute('aria-label')).toBe('sunrise.mp4');
    });

    test('Enter on the row presses it', () => {
        const row = host.querySelector('.app-background-list-item')!;

        pressEnterOn(row);

        expect(pressElementLikeButtonMock).toHaveBeenCalledTimes(1);
    });

    test('a key meant for a control inside the row is left to that control', () => {
        for (const button of host.querySelectorAll('button')) {
            pressEnterOn(button);
        }

        expect(host.querySelectorAll('button').length).toBeGreaterThan(1);
        expect(pressElementLikeButtonMock).not.toHaveBeenCalled();
    });
});
