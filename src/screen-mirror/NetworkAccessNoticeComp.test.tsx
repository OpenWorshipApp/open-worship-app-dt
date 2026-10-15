// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { MirrorFirewallStatus } from '../../electron/screenMirrorProtocol';

const h = vi.hoisted(() => ({
    status: null as MirrorFirewallStatus | null,
    command: vi.fn(),
    copy: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: (ms: number) => (callback: () => void) =>
        setTimeout(callback, ms),
}));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: h.copy }));
vi.mock('./mirrorConnectionHelpers', () => ({ mirrorCommand: h.command }));

import NetworkAccessNoticeComp from './NetworkAccessNoticeComp';

let container: HTMLDivElement;
let root: Root;
const status = (
    extra: Partial<MirrorFirewallStatus> = {},
): MirrorFirewallStatus => ({
    verdict: 'blocked',
    platform: 'win32',
    ruleNames: ['Open Worship App'],
    appName: 'OWA',
    port: 39240,
    ...extra,
});
async function render(port = 39240) {
    await act(async () => {
        root.render(createElement(NetworkAccessNoticeComp, { port }));
    });
}
function button(label: string) {
    const found = [...container.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
async function click(label: string) {
    await act(async () => {
        button(label).click();
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.status = status();
    h.command
        .mockReset()
        .mockImplementation(async (action: string) =>
            action === 'firewall' ? h.status : undefined,
        );
    h.copy.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

test('blocked Windows firewall shows rule names and opens the right settings', async () => {
    await render();
    expect(h.command).toHaveBeenCalledWith('firewall', { isForced: false });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Open Worship App',
    );
    await click('Open firewall settings');
    expect(h.command).toHaveBeenCalledWith('open-firewall-settings', {
        target: 'firewall',
    });
    await click('Check again');
    expect(h.command).toHaveBeenCalledWith('firewall', { isForced: true });
});

test('public-network refusal offers network settings and explains the private rule', async () => {
    h.status = status({ verdict: 'blocked-public', ruleNames: [] });
    await render();
    expect(container.textContent).toContain('This network is set as Public');
    expect(container.textContent).toContain('OWA');
    await click('Open network settings');
    expect(h.command).toHaveBeenCalledWith('open-firewall-settings', {
        target: 'network',
    });
});

test('macOS gives its own firewall steps; Linux gives a copyable command', async () => {
    h.status = status({ platform: 'darwin', appName: 'Worship Mac' });
    await render();
    expect(container.textContent).toContain('Click Options.');
    expect(container.textContent).toContain('Worship Mac');
    await act(async () => {
        root.unmount();
    });
    root = createRoot(container);
    h.status = status({ platform: 'linux', verdict: 'unknown', port: 41000 });
    await render(41000);
    expect(container.textContent).toContain('sudo ufw allow 41000/tcp');
    const copyButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Copy"]',
    )!;
    await act(async () => {
        copyButton.click();
    });
    expect(h.copy).toHaveBeenCalledWith('sudo ufw allow 41000/tcp', 'Copy');
});

test('healthy, unknown and failed firewall checks do not claim a blockage', async () => {
    h.status = status({ verdict: 'ok' });
    await render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => {
        root.unmount();
    });
    root = createRoot(container);
    h.status = status({ verdict: 'unknown', platform: 'win32' });
    await render();
    expect(container.textContent).toBe('');
    await act(async () => {
        root.unmount();
    });
    root = createRoot(container);
    h.command.mockRejectedValueOnce(new Error('unavailable'));
    await render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
});
