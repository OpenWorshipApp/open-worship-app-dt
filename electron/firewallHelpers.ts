import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { app, shell } from 'electron';

import type {
    MirrorFirewallStatus,
    MirrorFirewallVerdict,
} from './screenMirrorProtocol';

// Whether the operating system's firewall lets other computers reach this
// app, asked only when somebody has opened it to the network (Screen Mirror
// hosting, or Virtual Displays' "Let other devices watch") and is looking at
// the panel. Asking costs a PowerShell start on Windows -- seconds on a weak
// machine -- so it is never done at start-up, and an answer is kept a minute.
const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MILLISECOND = 15000;
const CACHE_TTL_MILLISECOND = 60000;

type WindowsFirewallReportType = {
    profiles?: {
        name?: string;
        enabled?: string;
        defaultInbound?: string;
        allowInboundRules?: string;
    }[];
    networks?: { alias?: string; category?: string }[];
    rules?: {
        name?: string;
        enabled?: string;
        action?: string;
        profile?: string;
    }[];
};

const VERDICT_RANK: Record<MirrorFirewallVerdict, number> = {
    ok: 0,
    unknown: 1,
    'not-allowed': 2,
    'blocked-public': 3,
    blocked: 4,
};

function toArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function toProfileName(category: string) {
    if (category === 'DomainAuthenticated') {
        return 'Domain';
    }
    return category;
}

function checkIsRuleOnProfile(ruleProfile: string, profile: string) {
    const names = ruleProfile.split(/,\s*/);
    return names.includes('Any') || names.includes(profile);
}

// The verdict for the networks this computer is on now, worst first. Pure, so
// every case is tested without a firewall.
export function readWindowsFirewallVerdict(report: WindowsFirewallReportType): {
    verdict: MirrorFirewallVerdict;
    ruleNames: string[];
} {
    const profiles = toArray(report.profiles);
    const rules = toArray(report.rules).filter((rule) => {
        return rule.enabled === 'True';
    });
    const ruleNames = [
        ...new Set(
            toArray(report.rules)
                .map((rule) => rule.name ?? '')
                .filter(Boolean),
        ),
    ];
    const activeProfiles = [
        ...new Set(
            toArray(report.networks).map((network) => {
                return toProfileName(network.category ?? '');
            }),
        ),
    ].filter(Boolean);
    if (activeProfiles.length === 0 || profiles.length === 0) {
        return { verdict: 'unknown', ruleNames };
    }
    let worst: MirrorFirewallVerdict = 'ok';
    for (const profileName of activeProfiles) {
        const profile = profiles.find((item) => item.name === profileName);
        let verdict: MirrorFirewallVerdict;
        if (profile === undefined) {
            verdict = 'unknown';
        } else if (profile.enabled !== 'True') {
            verdict = 'ok';
        } else if (profile.allowInboundRules === 'False') {
            // "Block all incoming connections, including those in the list
            // of allowed apps".
            verdict = 'blocked';
        } else {
            const onProfile = rules.filter((rule) => {
                return checkIsRuleOnProfile(rule.profile ?? '', profileName);
            });
            if (onProfile.some((rule) => rule.action === 'Block')) {
                verdict = 'blocked';
            } else if (onProfile.some((rule) => rule.action === 'Allow')) {
                verdict = 'ok';
            } else if (profile.defaultInbound === 'Allow') {
                verdict = 'ok';
            } else if (
                profileName === 'Public' &&
                rules.some((rule) => rule.action === 'Allow')
            ) {
                verdict = 'blocked-public';
            } else {
                verdict = 'not-allowed';
            }
        }
        if (VERDICT_RANK[verdict] > VERDICT_RANK[worst]) {
            worst = verdict;
        }
    }
    return { verdict: worst, ruleNames };
}

// `socketfilterfw` answers in sentences; read them by their words.
export function readMacFirewallVerdict({
    globalState,
    blockAll,
    appState,
}: {
    globalState: string;
    blockAll: string;
    appState: string;
}): MirrorFirewallVerdict {
    if (/disabled|state = 0/i.test(globalState)) {
        return 'ok';
    }
    if (!/enabled|state = [12]/i.test(globalState)) {
        return 'unknown';
    }
    if (/enabled/i.test(blockAll) && !/disabled/i.test(blockAll)) {
        return 'blocked';
    }
    if (/permitted|allow/i.test(appState)) {
        return 'ok';
    }
    if (/block/i.test(appState)) {
        return 'blocked';
    }
    return 'unknown';
}

function toPowerShellString(text: string) {
    return `'${text.replace(/'/g, "''")}'`;
}

async function runCommand(command: string, args: string[]) {
    const { stdout } = await execFileAsync(command, args, {
        timeout: COMMAND_TIMEOUT_MILLISECOND,
        windowsHide: true,
    });
    return stdout;
}

async function askWindowsFirewall() {
    const script = [
        `$exe = ${toPowerShellString(process.execPath)}`,
        '$profiles = @(Get-NetFirewallProfile | ForEach-Object { @{ name = "$($_.Name)"; enabled = "$($_.Enabled)"; defaultInbound = "$($_.DefaultInboundAction)"; allowInboundRules = "$($_.AllowInboundRules)" } })',
        '$networks = @(Get-NetConnectionProfile | ForEach-Object { @{ alias = "$($_.InterfaceAlias)"; category = "$($_.NetworkCategory)" } })',
        '$rules = @(Get-NetFirewallApplicationFilter -Program $exe -ErrorAction SilentlyContinue | Get-NetFirewallRule | Where-Object { "$($_.Direction)" -eq "Inbound" } | ForEach-Object { @{ name = "$($_.DisplayName)"; enabled = "$($_.Enabled)"; action = "$($_.Action)"; profile = "$($_.Profile)" } })',
        '@{ profiles = $profiles; networks = $networks; rules = $rules } | ConvertTo-Json -Depth 4 -Compress',
    ].join('; ');
    const stdout = await runCommand('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
    ]);
    return readWindowsFirewallVerdict(JSON.parse(stdout.trim()));
}

function toMacAppBundlePath() {
    const index = process.execPath.indexOf('.app/');
    return index === -1
        ? process.execPath
        : process.execPath.slice(0, index + 4);
}

async function askMacFirewall() {
    const tool = '/usr/libexec/ApplicationFirewall/socketfilterfw';
    const read = (args: string[]) => {
        return runCommand(tool, args).catch(() => '');
    };
    const [globalState, blockAll, appState] = await Promise.all([
        read(['--getglobalstate']),
        read(['--getblockall']),
        read(['--getappblocked', toMacAppBundlePath()]),
    ]);
    return readMacFirewallVerdict({ globalState, blockAll, appState });
}

function toPlatform(): MirrorFirewallStatus['platform'] {
    const platform = process.platform;
    if (platform === 'win32' || platform === 'darwin' || platform === 'linux') {
        return platform;
    }
    return 'other';
}

let cached: { status: MirrorFirewallStatus; timer: NodeJS.Timeout } | null =
    null;
let inFlight: Promise<MirrorFirewallStatus> | null = null;

function holdInCache(status: MirrorFirewallStatus) {
    if (cached !== null) {
        clearTimeout(cached.timer);
    }
    const timer = setTimeout(() => {
        cached = null;
    }, CACHE_TTL_MILLISECOND);
    // Never hold the process open for a cache sweep.
    timer.unref?.();
    cached = { status, timer };
}

export async function checkNetworkFirewall({
    port,
    isForced = false,
}: {
    port: number;
    isForced?: boolean;
}): Promise<MirrorFirewallStatus> {
    if (!isForced && cached !== null && cached.status.port === port) {
        return cached.status;
    }
    if (inFlight !== null) {
        return inFlight;
    }
    const platform = toPlatform();
    inFlight = (async () => {
        let verdict: MirrorFirewallVerdict = 'unknown';
        let ruleNames: string[] = [];
        try {
            if (platform === 'win32') {
                ({ verdict, ruleNames } = await askWindowsFirewall());
            } else if (platform === 'darwin') {
                verdict = await askMacFirewall();
            }
        } catch (error) {
            console.error('Firewall check failed:', error);
        }
        const status: MirrorFirewallStatus = {
            verdict,
            platform,
            ruleNames,
            appName: app.getName(),
            port,
        };
        holdInCache(status);
        return status;
    })();
    try {
        return await inFlight;
    } finally {
        inFlight = null;
    }
}

// The page where access is given back. The addresses are fixed here; a page
// only names which one it wants.
export async function openFirewallSettings(target: unknown) {
    const platform = process.platform;
    if (platform === 'win32') {
        if (target === 'network') {
            await shell.openExternal('ms-settings:network-status');
        } else {
            execFile(
                'control.exe',
                [
                    '/name',
                    'Microsoft.WindowsFirewall',
                    '/page',
                    'pageConfigureApps',
                ],
                { windowsHide: true },
                () => {},
            );
        }
        return true;
    }
    if (platform === 'darwin') {
        const isVentura = Number(os.release().split('.')[0]) >= 22;
        await shell.openExternal(
            isVentura
                ? 'x-apple.systempreferences:com.apple.Network-Settings.extension?Firewall'
                : 'x-apple.systempreferences:com.apple.preference.security?Firewall',
        );
        return true;
    }
    return false;
}
