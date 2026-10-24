import os from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    // What each command answers, by its first argument; an Error rejects.
    answers: new Map<string, string | Error>(),
    calls: [] as { command: string; args: string[] }[],
    openExternal: vi.fn(async (_url: string) => {}),
}));
vi.mock('node:child_process', () => {
    const execFile = (
        command: string,
        args: string[],
        _options: unknown,
        callback: (error: Error | null, result?: { stdout: string }) => void,
    ) => {
        fixture.calls.push({ command, args });
        const key = command === 'powershell.exe' ? command : args[0];
        const answer = fixture.answers.get(key);
        if (answer instanceof Error) {
            callback(answer);
        } else {
            callback(null, { stdout: answer ?? '' });
        }
    };
    return { execFile, default: { execFile } };
});
vi.mock('electron', () => ({
    app: { getName: () => 'Open Worship' },
    shell: { openExternal: fixture.openExternal },
}));

import {
    readMacFirewallVerdict,
    readWindowsFirewallVerdict,
} from './firewallHelpers';

type ReportType = Parameters<typeof readWindowsFirewallVerdict>[0];

function profile(
    name: string,
    {
        enabled = 'True',
        defaultInbound = 'NotConfigured',
        allowInboundRules = 'NotConfigured',
    } = {},
) {
    return { name, enabled, defaultInbound, allowInboundRules };
}

const PROFILES = [profile('Domain'), profile('Private'), profile('Public')];

function rule(
    name: string,
    action: 'Allow' | 'Block',
    ruleProfile: string,
    enabled = 'True',
) {
    return { name, enabled, action, profile: ruleProfile };
}

function on(category: string, alias = 'Wi-Fi') {
    return { alias, category };
}

describe('readWindowsFirewallVerdict', () => {
    test('unknown: no network, no profiles, or a network with no profile', () => {
        expect(
            readWindowsFirewallVerdict({ profiles: PROFILES, networks: [] }),
        ).toEqual({ verdict: 'unknown', ruleNames: [] });
        expect(
            readWindowsFirewallVerdict({
                profiles: [],
                networks: [on('Private')],
                rules: [rule('App', 'Allow', 'Any')],
            }),
        ).toEqual({ verdict: 'unknown', ruleNames: ['App'] });
        expect(readWindowsFirewallVerdict({})).toEqual({
            verdict: 'unknown',
            ruleNames: [],
        });
        expect(
            readWindowsFirewallVerdict({
                profiles: [profile('Private')],
                networks: [on('Public')],
            }).verdict,
        ).toBe('unknown');
    });

    test('ok: the firewall is off on this network', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: [profile('Private', { enabled: 'False' })],
                networks: [on('Private')],
            }).verdict,
        ).toBe('ok');
    });

    test('ok: an enabled Allow rule on this profile, "Any", or a list', () => {
        for (const ruleProfile of ['Private', 'Any', 'Domain, Private']) {
            expect(
                readWindowsFirewallVerdict({
                    profiles: PROFILES,
                    networks: [on('Private')],
                    rules: [rule('Open Worship', 'Allow', ruleProfile)],
                }),
            ).toEqual({ verdict: 'ok', ruleNames: ['Open Worship'] });
        }
    });

    test('ok: the profile lets everything in by default', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: [profile('Private', { defaultInbound: 'Allow' })],
                networks: [on('Private')],
            }).verdict,
        ).toBe('ok');
    });

    test('blocked: "Block all incoming connections"', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: [
                    profile('Private', {
                        allowInboundRules: 'False',
                        defaultInbound: 'Allow',
                    }),
                ],
                networks: [on('Private')],
                rules: [rule('Open Worship', 'Allow', 'Any')],
            }).verdict,
        ).toBe('blocked');
    });

    test('blocked: a Block rule on this profile beats an Allow rule', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Public')],
                rules: [
                    rule('Open Worship', 'Allow', 'Any'),
                    rule('Open Worship', 'Block', 'Private, Public'),
                ],
            }),
        ).toEqual({ verdict: 'blocked', ruleNames: ['Open Worship'] });
    });

    test('a disabled rule counts for nothing but is still named', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private')],
                rules: [
                    rule('Old block', 'Block', 'Any', 'False'),
                    rule('Open Worship', 'Allow', 'Private'),
                    rule('', 'Allow', 'Private'),
                ],
            }),
        ).toEqual({
            verdict: 'ok',
            ruleNames: ['Old block', 'Open Worship'],
        });
    });

    test('blocked-public: allowed on private networks only, on a public one', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Public')],
                rules: [rule('Open Worship', 'Allow', 'Private')],
            }).verdict,
        ).toBe('blocked-public');
    });

    test('not-allowed: nothing allows it and the default refuses', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private')],
                rules: [],
            }).verdict,
        ).toBe('not-allowed');
        // On a public network with no Allow rule anywhere it is not
        // "public only".
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Public')],
                rules: [rule('Off', 'Allow', 'Private', 'False')],
            }).verdict,
        ).toBe('not-allowed');
        // A Private-only rule does not help a Domain network.
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('DomainAuthenticated')],
                rules: [rule('Open Worship', 'Allow', 'Private')],
            }).verdict,
        ).toBe('not-allowed');
    });

    test('a DomainAuthenticated network reads the Domain profile', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: [profile('Domain', { enabled: 'False' })],
                networks: [on('DomainAuthenticated')],
            }).verdict,
        ).toBe('ok');
    });

    test('several networks: the worst verdict wins', () => {
        const rules = [rule('Open Worship', 'Allow', 'Private')];
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private', 'Ethernet'), on('Public')],
                rules,
            }).verdict,
        ).toBe('blocked-public');
        expect(
            readWindowsFirewallVerdict({
                profiles: [
                    profile('Private'),
                    profile('Public', { allowInboundRules: 'False' }),
                ],
                networks: [on('Public'), on('Private', 'Ethernet')],
                rules,
            }).verdict,
        ).toBe('blocked');
        // not-allowed outranks unknown.
        expect(
            readWindowsFirewallVerdict({
                profiles: [profile('Private')],
                networks: [on('Private'), on('Public', 'VPN')],
            }).verdict,
        ).toBe('not-allowed');
        // Two adapters on one category are asked once.
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private'), on('Private', 'Ethernet')],
                rules,
            }).verdict,
        ).toBe('ok');
    });

    test('ConvertTo-Json singles: one object where an array was meant', () => {
        const report = {
            profiles: profile('Private'),
            networks: on('Private'),
            rules: rule('Open Worship', 'Allow', 'Private'),
        } as unknown as ReportType;
        expect(readWindowsFirewallVerdict(report)).toEqual({
            verdict: 'ok',
            ruleNames: ['Open Worship'],
        });
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private')],
                rules: null,
            } as unknown as ReportType).verdict,
        ).toBe('not-allowed');
    });

    test('rule names are listed once each', () => {
        expect(
            readWindowsFirewallVerdict({
                profiles: PROFILES,
                networks: [on('Private')],
                rules: [
                    rule('Open Worship', 'Allow', 'Private'),
                    rule('Open Worship', 'Allow', 'Public'),
                    rule('Electron', 'Allow', 'Domain'),
                ],
            }).ruleNames,
        ).toEqual(['Open Worship', 'Electron']);
    });
});

describe('readMacFirewallVerdict', () => {
    const ON = 'Firewall is enabled. (State = 1)';
    const BLOCK_ALL_OFF = 'Firewall has block all state set to disabled.';

    test('ok: the firewall is off', () => {
        for (const globalState of [
            'Firewall is disabled. (State = 0)',
            'State = 0',
        ]) {
            expect(
                readMacFirewallVerdict({
                    globalState,
                    blockAll: 'Firewall has block all state set to enabled.',
                    appState: 'The application is blocking',
                }),
            ).toBe('ok');
        }
    });

    test('unknown: the state could not be read', () => {
        expect(
            readMacFirewallVerdict({
                globalState: '',
                blockAll: '',
                appState: '',
            }),
        ).toBe('unknown');
        expect(
            readMacFirewallVerdict({
                globalState: 'something else',
                blockAll: BLOCK_ALL_OFF,
                appState: 'permitted',
            }),
        ).toBe('unknown');
    });

    test('blocked: block all incoming, in either wording', () => {
        for (const blockAll of [
            'Firewall has block all state set to enabled.',
            'Block all ENABLED!',
        ]) {
            expect(
                readMacFirewallVerdict({
                    globalState: ON,
                    blockAll,
                    appState:
                        'The application /Applications/X.app is permitted',
                }),
            ).toBe('blocked');
        }
    });

    test('ok or blocked: what the app itself is allowed', () => {
        for (const blockAll of [BLOCK_ALL_OFF, 'Block all DISABLED!', '']) {
            expect(
                readMacFirewallVerdict({
                    globalState: ON,
                    blockAll,
                    appState:
                        'The application /Applications/Open Worship.app is permitted',
                }),
            ).toBe('ok');
        }
        expect(
            readMacFirewallVerdict({
                globalState: 'Firewall is enabled. (State = 2)',
                blockAll: BLOCK_ALL_OFF,
                appState: 'Incoming connection to the application is allowed',
            }),
        ).toBe('ok');
        expect(
            readMacFirewallVerdict({
                globalState: ON,
                blockAll: BLOCK_ALL_OFF,
                appState:
                    'The application /Applications/Open Worship.app is blocking incoming connections',
            }),
        ).toBe('blocked');
    });

    test('unknown: the app is not in the list', () => {
        expect(
            readMacFirewallVerdict({
                globalState: ON,
                blockAll: BLOCK_ALL_OFF,
                appState: 'The application is not part of the firewall',
            }),
        ).toBe('unknown');
    });
});

describe('checkNetworkFirewall and openFirewallSettings', () => {
    const realPlatform = process.platform;
    const WINDOWS_REPORT = JSON.stringify({
        profiles: PROFILES,
        networks: [on('Private')],
        rules: [rule('Open Worship', 'Allow', 'Private')],
    });

    function setPlatform(platform: NodeJS.Platform) {
        Object.defineProperty(process, 'platform', {
            value: platform,
            configurable: true,
        });
    }

    async function load() {
        // The answer cache lives in the module: a fresh one per test.
        vi.resetModules();
        return await import('./firewallHelpers');
    }

    beforeEach(() => {
        fixture.answers.clear();
        fixture.calls.length = 0;
        vi.useFakeTimers();
    });

    afterEach(() => {
        setPlatform(realPlatform);
        vi.useRealTimers();
    });

    test('Windows: asks PowerShell once, then answers from the cache', async () => {
        setPlatform('win32');
        fixture.answers.set('powershell.exe', `${WINDOWS_REPORT}\r\n`);
        const { checkNetworkFirewall } = await load();
        const status = await checkNetworkFirewall({ port: 40001 });
        expect(status).toEqual({
            verdict: 'ok',
            platform: 'win32',
            ruleNames: ['Open Worship'],
            appName: 'Open Worship',
            port: 40001,
        });
        expect(fixture.calls).toHaveLength(1);
        expect(fixture.calls[0].args).toContain('-NonInteractive');
        expect(fixture.calls[0].args.at(-1)).toContain(
            'Get-NetFirewallProfile',
        );
        expect(await checkNetworkFirewall({ port: 40001 })).toBe(status);
        expect(fixture.calls).toHaveLength(1);
        // Forced, or for another port, it is asked again.
        await checkNetworkFirewall({ port: 40001, isForced: true });
        await checkNetworkFirewall({ port: 40002 });
        expect(fixture.calls).toHaveLength(3);
    });

    test('the cache lasts a minute', async () => {
        setPlatform('win32');
        fixture.answers.set('powershell.exe', WINDOWS_REPORT);
        const { checkNetworkFirewall } = await load();
        await checkNetworkFirewall({ port: 40001 });
        vi.advanceTimersByTime(59999);
        await checkNetworkFirewall({ port: 40001 });
        expect(fixture.calls).toHaveLength(1);
        vi.advanceTimersByTime(1);
        await checkNetworkFirewall({ port: 40001 });
        expect(fixture.calls).toHaveLength(2);
    });

    test('calls at the same time share one question', async () => {
        setPlatform('win32');
        fixture.answers.set('powershell.exe', WINDOWS_REPORT);
        const { checkNetworkFirewall } = await load();
        const [first, second] = await Promise.all([
            checkNetworkFirewall({ port: 40001 }),
            checkNetworkFirewall({ port: 40001, isForced: true }),
        ]);
        expect(first).toBe(second);
        expect(fixture.calls).toHaveLength(1);
    });

    test('a failed or unreadable answer is unknown, never thrown', async () => {
        setPlatform('win32');
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        fixture.answers.set('powershell.exe', 'not json');
        const { checkNetworkFirewall } = await load();
        expect(await checkNetworkFirewall({ port: 40001 })).toMatchObject({
            verdict: 'unknown',
            ruleNames: [],
        });
        fixture.answers.set('powershell.exe', new Error('timed out'));
        expect(
            await checkNetworkFirewall({ port: 40001, isForced: true }),
        ).toMatchObject({ verdict: 'unknown' });
        expect(consoleError).toHaveBeenCalledTimes(2);
    });

    test('macOS: socketfilterfw is asked about the .app bundle', async () => {
        setPlatform('darwin');
        const execPath = process.execPath;
        Object.defineProperty(process, 'execPath', {
            value: '/Applications/Open Worship.app/Contents/MacOS/Open Worship',
            configurable: true,
        });
        try {
            fixture.answers.set(
                '--getglobalstate',
                'Firewall is enabled. (State = 1)',
            );
            fixture.answers.set(
                '--getblockall',
                'Firewall has block all state set to disabled.',
            );
            fixture.answers.set('--getappblocked', 'is permitted');
            const { checkNetworkFirewall } = await load();
            const status = await checkNetworkFirewall({ port: 40001 });
            expect(status).toMatchObject({
                verdict: 'ok',
                platform: 'darwin',
                ruleNames: [],
            });
            const appCall = fixture.calls.find((call) => {
                return call.args[0] === '--getappblocked';
            });
            expect(appCall?.command).toBe(
                '/usr/libexec/ApplicationFirewall/socketfilterfw',
            );
            expect(appCall?.args[1]).toBe('/Applications/Open Worship.app');
        } finally {
            Object.defineProperty(process, 'execPath', {
                value: execPath,
                configurable: true,
            });
        }
    });

    test('macOS: one unreadable answer does not fail the others', async () => {
        setPlatform('darwin');
        fixture.answers.set(
            '--getglobalstate',
            'Firewall is enabled. (State = 1)',
        );
        fixture.answers.set('--getblockall', new Error('denied'));
        fixture.answers.set('--getappblocked', 'is blocking incoming');
        const { checkNetworkFirewall } = await load();
        expect((await checkNetworkFirewall({ port: 40001 })).verdict).toBe(
            'blocked',
        );
    });

    test('Linux and others: unknown without asking anything', async () => {
        for (const platform of ['linux', 'freebsd'] as const) {
            setPlatform(platform);
            const { checkNetworkFirewall } = await load();
            expect(await checkNetworkFirewall({ port: 40001 })).toMatchObject({
                verdict: 'unknown',
                platform: platform === 'linux' ? 'linux' : 'other',
            });
        }
        expect(fixture.calls).toEqual([]);
    });

    test('openFirewallSettings opens only its own fixed pages', async () => {
        const shell = { openExternal: fixture.openExternal };
        setPlatform('win32');
        const { openFirewallSettings } = await load();
        expect(await openFirewallSettings('network')).toBe(true);
        expect(shell.openExternal).toHaveBeenCalledWith(
            'ms-settings:network-status',
        );
        expect(await openFirewallSettings('https://evil.example')).toBe(true);
        expect(fixture.calls.at(-1)).toEqual({
            command: 'control.exe',
            args: [
                '/name',
                'Microsoft.WindowsFirewall',
                '/page',
                'pageConfigureApps',
            ],
        });
        expect(shell.openExternal).toHaveBeenCalledTimes(1);

        setPlatform('darwin');
        vi.spyOn(os, 'release').mockReturnValue('23.1.0');
        expect(await openFirewallSettings('app')).toBe(true);
        expect(shell.openExternal).toHaveBeenLastCalledWith(
            'x-apple.systempreferences:com.apple.Network-Settings.extension?Firewall',
        );
        vi.spyOn(os, 'release').mockReturnValue('21.6.0');
        await openFirewallSettings('app');
        expect(shell.openExternal).toHaveBeenLastCalledWith(
            'x-apple.systempreferences:com.apple.preference.security?Firewall',
        );

        setPlatform('linux');
        expect(await openFirewallSettings('app')).toBe(false);
        expect(shell.openExternal).toHaveBeenCalledTimes(3);
    });
});
