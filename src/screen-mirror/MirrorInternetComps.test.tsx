// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { mirrorCommand, openOthersSetting } = vi.hoisted(() => ({
    mirrorCommand: vi.fn(async () => undefined),
    openOthersSetting: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./mirrorConnectionHelpers', () => ({ mirrorCommand }));
vi.mock('./MirrorNetworkComps', () => ({}));
// A folded note keeps its state in a setting; here it is plain state.
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (_name: string, value?: boolean) => {
            return useState(!!value);
        },
    };
});
vi.mock('../setting/settingHelpers', () => ({ openOthersSetting }));

import {
    MirrorCustomPortComp,
    MirrorGuestAccessComp,
    MirrorInternetWarningComp,
    MirrorPublicAddressComp,
    MirrorTunnelComp,
} from './MirrorInternetComps';

// The connection settings both tabs share: each is drawn once here and
// pressed as an operator would.
let container: HTMLDivElement;
let root: Root;
const perform = async (work: () => Promise<unknown>) => {
    await work();
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mirrorCommand.mockClear();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(element: React.ReactElement) {
    act(() => root.render(element));
}
function button(text: string) {
    return [...container.querySelectorAll('button')].find((item) => {
        return item.textContent === text;
    })!;
}
// React reads a typed value through the native setter.
function type(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

test('guest access: the mode, the code, and a warning while no code is set', async () => {
    const onMode = vi.fn(async () => {});
    const onCode = vi.fn(async () => {});
    const draw = (mode: 'approve' | 'code', hasCode: boolean) => {
        render(
            <MirrorGuestAccessComp
                mode={mode}
                hasCode={hasCode}
                busy={false}
                onMode={onMode}
                onCode={onCode}
            />,
        );
    };
    draw('approve', false);
    expect(container.querySelector('input')).toBeNull();
    const select = container.querySelector('select')!;
    act(() => {
        select.value = 'code';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onMode).toHaveBeenCalledWith('code');
    draw('code', false);
    expect(container.textContent).toContain(
        'Set a connection code: until then no one can come in with a code.',
    );
    expect(button('Set connection code').disabled).toBe(true);
    type(container.querySelector('input')!, 'church-1234');
    await act(async () => button('Set connection code').click());
    expect(onCode).toHaveBeenCalledWith('church-1234');
    draw('code', true);
    expect(container.textContent).not.toContain('until then');
    expect(container.querySelector('input')!.placeholder).toBe('Code is set');
});

test('the tunnel switch, and what the tunnel is doing', async () => {
    const draw = (tunnelEnabled: boolean, tunnel: any) => {
        render(
            <MirrorTunnelComp
                state={{ tunnelEnabled, tunnel }}
                busy={false}
                perform={perform}
                idPrefix="test"
            />,
        );
    };
    draw(false, { status: 'off', url: '', error: '' });
    expect(container.querySelector('[role="status"]')).toBeNull();
    await act(async () => {
        (container.querySelector('[role="switch"]') as HTMLElement).click();
    });
    expect(mirrorCommand).toHaveBeenCalledWith('tunnel', { enabled: true });
    draw(true, { status: 'starting', url: '', error: '' });
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
        'Starting the tunnel…',
    );
    draw(true, { status: 'up', url: 'https://a.trycloudflare.com', error: '' });
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
        'The tunnel is up.',
    );
    expect(button('Go to Settings')).toBeUndefined();
    draw(true, { status: 'error', url: '', error: 'stopped' });
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
        'The tunnel stopped. It starts again by itself.',
    );
    expect(button('Go to Settings')).toBeUndefined();
});

// cloudflared comes with the extra-bin pack: without it the panel says so
// and takes the operator to the Settings panel that installs it.
test('a tunnel waiting for the Extra Binaries leads to Settings', async () => {
    render(
        <MirrorTunnelComp
            state={{
                tunnelEnabled: true,
                tunnel: { status: 'error', url: '', error: 'missing' },
            }}
            busy={false}
            perform={perform}
            idPrefix="test"
        />,
    );
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
        'The tunnel comes with the Extra Binaries. Install or update them in Settings, and it starts by itself.',
    );
    await act(async () => {
        button('Go to Settings').click();
    });
    await vi.waitFor(() => expect(openOthersSetting).toHaveBeenCalledTimes(1));
});

// A tunnel that would not run at all (`failed`) has no advice of its own and
// no way to Settings: the Extra Binaries are there.
test('a tunnel that will not run says so, with no way to Settings', () => {
    render(
        <MirrorTunnelComp
            state={{
                tunnelEnabled: true,
                tunnel: { status: 'error', url: '', error: 'failed' },
            }}
            busy={false}
            perform={perform}
            idPrefix="test"
        />,
    );
    const status = container.querySelector('[role="status"]')!;
    expect(status.textContent).toBe('The tunnel is not working.');
    expect(status.className).toBe('text-warning');
    expect(button('Go to Settings')).toBeUndefined();
});

test('the public address is saved as typed, then the box empties to show it', async () => {
    const draw = (publicAddress: string, busy = false) => {
        render(
            <MirrorPublicAddressComp
                publicAddress={publicAddress}
                busy={busy}
                perform={perform}
            />,
        );
    };
    draw('');
    const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Public address (optional)"]',
    )!;
    // Nothing kept yet: an example of what to type.
    expect(input.placeholder).toBe('example.ddns.net');
    type(input, 'church.ddns.net');
    expect(input.value).toBe('church.ddns.net');
    await act(async () => button('Save address').click());
    expect(mirrorCommand).toHaveBeenCalledExactlyOnceWith('public-address', {
        text: 'church.ddns.net',
    });
    expect(input.value).toBe('');
    // The kept one is what the empty box shows.
    draw('church.ddns.net');
    expect(input.placeholder).toBe('church.ddns.net');
    // An empty save clears it.
    await act(async () => button('Save address').click());
    expect(mirrorCommand).toHaveBeenLastCalledWith('public-address', {
        text: '',
    });
    draw('church.ddns.net', true);
    expect(button('Save address').disabled).toBe(true);
});

test('a public address the server refuses stays in the box to be fixed', async () => {
    mirrorCommand.mockRejectedValueOnce(new Error('Invalid host or port'));
    const failures: unknown[] = [];
    render(
        <MirrorPublicAddressComp
            publicAddress=""
            busy={false}
            perform={async (work) => {
                await work().catch((error: unknown) => {
                    failures.push(error);
                });
            }}
        />,
    );
    const input = container.querySelector<HTMLInputElement>('input')!;
    type(input, 'not an address');
    await act(async () => button('Save address').click());
    expect(failures).toHaveLength(1);
    expect(input.value).toBe('not an address');
});

test('the custom port takes a port or nothing', async () => {
    render(
        <MirrorCustomPortComp
            customPort={null}
            busy={false}
            perform={perform}
        />,
    );
    const input = container.querySelector('input')!;
    type(input, '70000');
    expect(button('Save port').disabled).toBe(true);
    type(input, '40500');
    await act(async () => button('Save port').click());
    expect(mirrorCommand).toHaveBeenLastCalledWith('custom-port', {
        port: 40500,
    });
    await act(async () => button('Save port').click());
    expect(mirrorCommand).toHaveBeenLastCalledWith('custom-port', {
        port: null,
    });
});

// The long notes pushed the switches off the panel: folded, a note is one
// line that still reads as a warning; the chevron opens it.
test('the internet warning is one folded line until it is opened', () => {
    render(<MirrorInternetWarningComp />);
    const note = container.querySelector('.alert-warning')!;
    expect(note.textContent).toContain('Anyone who has the address');
    const toggle = note.querySelector('button')!;
    const text = toggle.nextElementSibling as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.title).toBe('Expand');
    expect(text.style.webkitLineClamp).toBe('1');

    act(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.title).toBe('Collapse');
    expect(text.style.webkitLineClamp).toBe('');

    act(() => toggle.click());
    expect(text.style.webkitLineClamp).toBe('1');
    // A click on the folded line opens it too.
    act(() => text.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
});
