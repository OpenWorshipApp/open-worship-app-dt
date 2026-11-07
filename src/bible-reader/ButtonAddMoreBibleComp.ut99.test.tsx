// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        showBibleKeyOption: vi.fn(),
        fromJson: vi.fn(),
    };
});

vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOption,
}));
vi.mock('./ReadIdOnlyBibleItem', () => ({
    ReadIdOnlyBibleItem: { fromJson: h.fromJson },
}));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import ButtonAddMoreBibleComp from './ButtonAddMoreBibleComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genItem(bibleKey: string) {
    const json = {
        id: 1,
        bibleKey,
        target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 },
    };
    return { ...json, toJson: () => ({ ...json }) } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.fromJson.mockImplementation((json: object) => ({ ...json }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('ButtonAddMoreBibleComp', () => {
    test('with nothing to copy it cannot add', async () => {
        await act(async () => {
            root.render(
                <ButtonAddMoreBibleComp
                    bibleItems={[]}
                    applyPresents={vi.fn()}
                />,
            );
        });
        const button = host.querySelector('button')!;
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe(' Add Item');
    });

    test('adds the first passage again, in the bible picked', async () => {
        const applyPresents = vi.fn();
        const first = genItem('KJV');
        const second = genItem('KHM');
        await act(async () => {
            root.render(
                <ButtonAddMoreBibleComp
                    bibleItems={[first, second]}
                    applyPresents={applyPresents}
                />,
            );
        });
        await act(async () => {
            host.querySelector('button')!.click();
        });
        expect(h.showBibleKeyOption).toHaveBeenCalledTimes(1);
        const [event, onPick] = h.showBibleKeyOption.mock.calls[0];
        expect(event.type).toBe('click');
        expect(applyPresents).not.toHaveBeenCalled();

        onPick('NIV');
        expect(h.fromJson).toHaveBeenCalledWith(first.toJson());
        expect(applyPresents).toHaveBeenCalledTimes(1);
        const [newItemList] = applyPresents.mock.calls[0];
        expect(newItemList.slice(0, 2)).toEqual([first, second]);
        expect(newItemList[2]).toEqual({ ...first.toJson(), bibleKey: 'NIV' });
    });
});
