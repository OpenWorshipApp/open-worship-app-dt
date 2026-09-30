// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
    PropChipsComp,
    PropOptionsComp,
    PropSwatchComp,
    PropTogglesComp,
} from './ForegroundPropRowComp';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test('property controls expose selected state and relay explicit choices', async () => {
    const choose = vi.fn();
    const toggle = vi.fn();
    const open = vi.fn();
    await act(async () =>
        root.render(
            <>
                <PropChipsComp
                    label="Size"
                    values={[0, 12]}
                    value={0}
                    zeroLabel="Auto"
                    setValue={choose}
                />
                <PropOptionsComp
                    label="Border"
                    value="solid"
                    setValue={choose}
                    options={[
                        { value: 'solid', label: 'Solid' },
                        { value: 'none', label: 'None', iconClassName: 'bi-x' },
                    ]}
                />
                <PropTogglesComp
                    label="Text"
                    items={[
                        {
                            key: 'italic',
                            label: 'Italic',
                            isOn: true,
                            onToggle: toggle,
                            text: 'I',
                        },
                    ]}
                />
                <PropSwatchComp
                    label="Color"
                    color="#123456"
                    isOpened={false}
                    onToggle={open}
                />
            </>,
        ),
    );
    const buttons = host.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Auto');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
        (buttons[1] as HTMLButtonElement).click();
        (buttons[2] as HTMLButtonElement).click();
        (buttons[4] as HTMLButtonElement).click();
        (buttons[5] as HTMLButtonElement).click();
    });
    expect(choose).toHaveBeenCalledWith(12);
    expect(choose).toHaveBeenCalledWith('solid');
    expect(toggle).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
});
