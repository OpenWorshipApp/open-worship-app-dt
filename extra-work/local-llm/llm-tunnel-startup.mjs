// llm-tunnel-startup.mjs
// Makes llm-tunnel.mjs start with the computer and come back when it stops,
// with what each OS has for that:
//   Linux    a systemd user service (Restart=always), kept past logout by
//            `loginctl enable-linger`; with no systemd, two cron lines to add
//   macOS    a launchd agent (RunAtLoad + KeepAlive)
//   Windows  a Task Scheduler task: at logon, then every few minutes for as
//            long as it is not already running, with no window
//
// One service per tunnel, named by the tunnel's server id, so several
// tunnels -- one for each LLM server -- can be installed side by side.
//
// Nothing here needs an administrator, which is also its limit: on macOS and
// Windows "with the computer" means when this user logs in.
//
// Usage: node llm-tunnel-startup.mjs install [--every <minutes>] [--dry-run]
//                                            [-- <llm-tunnel.mjs options>]
//        node llm-tunnel-startup.mjs uninstall [--id <id>] [--dry-run]
//                                            [-- <llm-tunnel.mjs options>]
//        node llm-tunnel-startup.mjs status [--id <id>]
//                                            [-- <llm-tunnel.mjs options>]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    getLockFile,
    getPidFile,
    readArgs,
    readProcessCommand,
    USAGE,
} from './llm-tunnel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TUNNEL_SCRIPT = path.join(HERE, 'llm-tunnel.mjs');
const ID_PATTERN = /^[A-Za-z0-9-]{1,48}$/;
const DEFAULT_EVERY_MINUTES = 5;

// What each OS knows a tunnel by: its server id is in every name.
export function getServiceName(id) {
    return `owa-llm-tunnel-${id}`;
}

export function getLaunchdLabel(id) {
    return `app.openworship.llm-tunnel.${id}`;
}

export function getTaskName(id) {
    return `Open Worship LLM Tunnel (${id})`;
}

function getLogFile(id) {
    return path.join(HERE, `tunnel-${id}.log`);
}

function genDescription(id) {
    return `Open Worship local LLM tunnel "${id}" (API-key door + Cloudflare quick tunnel)`;
}

export const STARTUP_USAGE = [
    'Usage: node llm-tunnel-startup.mjs install [--every <minutes>] [--dry-run]',
    '                                           [-- <llm-tunnel.mjs options>]',
    '       node llm-tunnel-startup.mjs uninstall [--id <id>] [--dry-run]',
    '                                           [-- <llm-tunnel.mjs options>]',
    '       node llm-tunnel-startup.mjs status [--id <id>]',
    '                                           [-- <llm-tunnel.mjs options>]',
    '',
    '  --every    Windows and cron: how often it is started again when it is',
    `             not running, in minutes (${DEFAULT_EVERY_MINUTES})`,
    '  --id       which tunnel: the server id it was installed with. Left out,',
    '             it is the id the options after -- give (llm-<port> by',
    '             default), as for install',
    '  --dry-run  show what would be written and run, and change nothing',
    '',
    'Example: node llm-tunnel-startup.mjs install -- --port 1234 --publish',
].join('\n');

/** The command and its options, or null when they cannot be read. */
export function readStartupArgs(argv) {
    const split = argv.indexOf('--');
    const own = split === -1 ? argv : argv.slice(0, split);
    const tunnelArgs = split === -1 ? [] : argv.slice(split + 1);
    const options = {
        command: own[0] ?? '',
        everyMinutes: DEFAULT_EVERY_MINUTES,
        isDryRun: false,
        id: '',
        tunnelArgs,
    };
    let isBad = !['install', 'uninstall', 'status'].includes(options.command);
    for (let i = 1; i < own.length; i++) {
        if (own[i] === '--every') {
            options.everyMinutes = Number(own[++i]);
        } else if (own[i] === '--dry-run') {
            options.isDryRun = true;
        } else if (own[i] === '--id' && options.command !== 'install') {
            // An installed tunnel's id is the one its own options give.
            options.id = String(own[++i] ?? '');
            isBad = isBad || !ID_PATTERN.test(options.id);
        } else {
            isBad = true;
        }
    }
    if (
        isBad ||
        !Number.isInteger(options.everyMinutes) ||
        options.everyMinutes < 1 ||
        options.everyMinutes > 1440
    ) {
        return null;
    }
    return options;
}

/** One argument of a systemd `ExecStart=` line. */
export function toSystemdArg(text) {
    return `"${toSystemdPath(text).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

// `%` and `$` are systemd's own: doubled, they are the characters themselves.
function toSystemdPath(text) {
    return text.replaceAll('%', '%%').replaceAll('$', () => {
        return '$$';
    });
}

export function genSystemdUnit({ node, script, tunnelArgs, dir, id }) {
    return [
        '[Unit]',
        `Description=${toSystemdPath(genDescription(id))}`,
        '',
        '[Service]',
        `ExecStart=${[node, script, ...tunnelArgs].map(toSystemdArg).join(' ')}`,
        `WorkingDirectory=${toSystemdPath(dir)}`,
        // The script closes its tunnel on SIGTERM; when it stops for any
        // other reason it is started again.
        'Restart=always',
        'RestartSec=30',
        '',
        '[Install]',
        'WantedBy=default.target',
        '',
    ].join('\n');
}

function toShellArg(text) {
    return `'${text.replaceAll("'", "'\\''")}'`;
}

/** For a Linux with no systemd: started at boot, and again when not running. */
export function genCronLines({ node, script, tunnelArgs, everyMinutes }) {
    // A `%` in a crontab line is a line break unless escaped.
    const command = [node, script, ...tunnelArgs]
        .map(toShellArg)
        .join(' ')
        .replaceAll('%', '\\%');
    const minutes =
        everyMinutes < 60 ? `*/${everyMinutes} * * * *` : '0 * * * *';
    return [`@reboot ${command}`, `${minutes} ${command}`];
}

function toXmlText(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function genLaunchdPlist({ node, script, tunnelArgs, dir, id }) {
    const toString = (text) => {
        return `        <string>${toXmlText(text)}</string>`;
    };
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        '<dict>',
        '    <key>Label</key>',
        `    <string>${toXmlText(getLaunchdLabel(id))}</string>`,
        '    <key>ProgramArguments</key>',
        '    <array>',
        ...[node, script, ...tunnelArgs].map(toString),
        '    </array>',
        '    <key>WorkingDirectory</key>',
        `    <string>${toXmlText(dir)}</string>`,
        '    <key>RunAtLoad</key>',
        '    <true/>',
        '    <key>KeepAlive</key>',
        '    <true/>',
        '    <key>ThrottleInterval</key>',
        '    <integer>30</integer>',
        '</dict>',
        '</plist>',
        '',
    ].join('\n');
}

function toPowerShellArg(text) {
    return `'${text.replaceAll("'", "''")}'`;
}

/**
 * A time as Task Scheduler reads one: local, to the second, no zone.
 */
export function toTaskTime(date) {
    const pad = (value) => {
        return String(value).padStart(2, '0');
    };
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

/**
 * A Task Scheduler task as XML: at this user's logon, and every few minutes
 * from the moment it is installed, for good -- and a start that finds it
 * running is dropped (`IgnoreNew`), so the repeat is what brings a stopped
 * tunnel back. PowerShell is only there to hide the console window a task
 * would otherwise open on the desktop.
 *
 * TWO triggers, and the second is the one that matters on the day: a
 * logon trigger's repeat starts at the logon, so a task installed in the
 * middle of a session -- which is how it is always installed -- ran once and
 * never again until the next logon (2026-10-15: the report inbox was
 * stopped on purpose to watch it come back, and nothing came; `schtasks`
 * said _Next Run Time: N/A_). The time trigger starts at `startAt` and
 * repeats with no end, past restarts as well.
 */
export function genTaskXml({
    node,
    script,
    tunnelArgs,
    dir,
    user,
    everyMinutes,
    id,
    startAt = toTaskTime(new Date()),
}) {
    const command = `& ${[node, script, ...tunnelArgs].map(toPowerShellArg).join(' ')}`;
    const powerShellArgs = `-NoProfile -NonInteractive -WindowStyle Hidden -Command "${command.replaceAll('"', '\\"')}"`;
    return [
        '<?xml version="1.0" encoding="UTF-16"?>',
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
        '  <RegistrationInfo>',
        `    <Description>${toXmlText(genDescription(id))}</Description>`,
        '  </RegistrationInfo>',
        '  <Triggers>',
        '    <LogonTrigger>',
        '      <Repetition>',
        `        <Interval>PT${everyMinutes}M</Interval>`,
        '        <StopAtDurationEnd>false</StopAtDurationEnd>',
        '      </Repetition>',
        '      <Enabled>true</Enabled>',
        `      <UserId>${toXmlText(user)}</UserId>`,
        '    </LogonTrigger>',
        '    <TimeTrigger>',
        '      <Repetition>',
        `        <Interval>PT${everyMinutes}M</Interval>`,
        '        <StopAtDurationEnd>false</StopAtDurationEnd>',
        '      </Repetition>',
        `      <StartBoundary>${toXmlText(startAt)}</StartBoundary>`,
        '      <Enabled>true</Enabled>',
        '    </TimeTrigger>',
        '  </Triggers>',
        '  <Principals>',
        '    <Principal id="Author">',
        `      <UserId>${toXmlText(user)}</UserId>`,
        '      <LogonType>InteractiveToken</LogonType>',
        '      <RunLevel>LeastPrivilege</RunLevel>',
        '    </Principal>',
        '  </Principals>',
        '  <Settings>',
        '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
        '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
        '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
        '    <StartWhenAvailable>true</StartWhenAvailable>',
        '    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
        '    <Enabled>true</Enabled>',
        '  </Settings>',
        '  <Actions Context="Author">',
        '    <Exec>',
        '      <Command>powershell.exe</Command>',
        `      <Arguments>${toXmlText(powerShellArgs)}</Arguments>`,
        `      <WorkingDirectory>${toXmlText(dir)}</WorkingDirectory>`,
        '    </Exec>',
        '  </Actions>',
        '</Task>',
        '',
    ].join('\r\n');
}

let isDryRun = false;

// Shows the command, and runs it unless this is a dry run. True when it
// worked.
function run(command, args) {
    console.log(`> ${[command, ...args].join(' ')}`);
    if (isDryRun) {
        return true;
    }
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        windowsHide: true,
    });
    return result.status === 0;
}

function ask(command, args) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        windowsHide: true,
    });
    return {
        isOk: result.status === 0,
        text: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    };
}

function writeFile(file, content, encoding = 'utf8') {
    console.log(`Writing ${file}:\n`);
    console.log(content);
    if (isDryRun) {
        return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        // schtasks wants the byte-order mark in front.
        encoding === 'utf16le'
            ? `${String.fromCharCode(0xfeff)}${content}`
            : content,
        encoding,
    );
}

function removeFile(file) {
    console.log(`Removing ${file}`);
    if (!isDryRun) {
        fs.rmSync(file, { force: true });
    }
}

function readPid(file) {
    try {
        const pid = Number(fs.readFileSync(file, 'utf8').trim());
        return Number.isInteger(pid) && pid > 0 ? pid : 0;
    } catch {
        return 0;
    }
}

function findRunning(file, pattern) {
    const pid = readPid(file);
    return pid !== 0 && pattern.test(readProcessCommand(pid)) ? pid : 0;
}

function findRunningTunnel(id) {
    return findRunning(
        getLockFile(id),
        process.platform === 'win32' ? /node/i : /llm-tunnel/,
    );
}

// Ending the service is the polite way and closes the tunnel properly; this
// is for what it left behind (on Windows a task's children outlive it).
function endWhatIsLeft(id) {
    for (const pid of [
        findRunningTunnel(id),
        findRunning(getPidFile(id), /cloudflared/i),
    ]) {
        if (pid === 0) {
            continue;
        }
        console.log(`Ending what is still running (pid ${pid})`);
        if (!isDryRun) {
            try {
                process.kill(pid);
            } catch {
                // Already gone.
            }
        }
    }
}

// A service manager keeps only what a program prints, or nothing: the tunnel
// writes its own capped log unless it was told where to.
function withLog(tunnelArgs, id) {
    return tunnelArgs.includes('--log')
        ? tunnelArgs
        : [...tunnelArgs, '--log', getLogFile(id)];
}

function getSystemdUnitFile(id) {
    return path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'systemd',
        'user',
        `${getServiceName(id)}.service`,
    );
}

function checkHasSystemdUser() {
    return ask('systemctl', ['--user', 'show-environment']).isOk;
}

function installLinux(options, id) {
    const node = process.execPath;
    if (!checkHasSystemdUser()) {
        console.log(
            'No systemd for this user here (systemctl --user does not answer).',
        );
        console.log('Add these two lines with `crontab -e` instead:\n');
        for (const line of genCronLines({
            node,
            script: TUNNEL_SCRIPT,
            tunnelArgs: withLog(options.tunnelArgs, id),
            everyMinutes: options.everyMinutes,
        })) {
            console.log(line);
        }
        return;
    }
    writeFile(
        getSystemdUnitFile(id),
        genSystemdUnit({
            node,
            script: TUNNEL_SCRIPT,
            tunnelArgs: options.tunnelArgs,
            dir: HERE,
            id,
        }),
    );
    const service = `${getServiceName(id)}.service`;
    const isStarted =
        run('systemctl', ['--user', 'daemon-reload']) &&
        run('systemctl', ['--user', 'enable', service]) &&
        run('systemctl', ['--user', 'restart', service]);
    if (!isStarted) {
        throw new Error('systemd did not take the service');
    }
    // Without this a user's services stop at logout and wait for a login.
    const user = os.userInfo().username;
    if (!run('loginctl', ['enable-linger', user])) {
        console.log(
            `\nTo have it start before anyone logs in, and stay after logout:\n  sudo loginctl enable-linger ${user}`,
        );
    }
    console.log(
        `\nWhat it says: journalctl --user -u ${getServiceName(id)} -f`,
    );
}

function uninstallLinux(id) {
    const service = `${getServiceName(id)}.service`;
    if (checkHasSystemdUser()) {
        run('systemctl', ['--user', 'disable', '--now', service]);
    }
    removeFile(getSystemdUnitFile(id));
    if (checkHasSystemdUser()) {
        run('systemctl', ['--user', 'daemon-reload']);
    }
    console.log(
        'If cron lines were added by hand, remove them with `crontab -e`.',
    );
}

function statusLinux(id) {
    const service = `${getServiceName(id)}.service`;
    const unitFile = getSystemdUnitFile(id);
    const isInstalled = fs.existsSync(unitFile);
    console.log(`Installed: ${isInstalled ? unitFile : 'no'}`);
    if (isInstalled) {
        console.log(
            `Enabled:   ${ask('systemctl', ['--user', 'is-enabled', service]).text}`,
        );
        console.log(
            `Service:   ${ask('systemctl', ['--user', 'is-active', service]).text}`,
        );
    }
}

function getLaunchdPlistFile(id) {
    return path.join(
        os.homedir(),
        'Library',
        'LaunchAgents',
        `${getLaunchdLabel(id)}.plist`,
    );
}

function getLaunchdDomain() {
    return `gui/${os.userInfo().uid}`;
}

function installMac(options, id) {
    const plistFile = getLaunchdPlistFile(id);
    const target = `${getLaunchdDomain()}/${getLaunchdLabel(id)}`;
    // An earlier one is taken out first, or the new file is not read.
    if (fs.existsSync(plistFile)) {
        run('launchctl', ['bootout', target]);
    }
    writeFile(
        plistFile,
        genLaunchdPlist({
            node: process.execPath,
            script: TUNNEL_SCRIPT,
            tunnelArgs: withLog(options.tunnelArgs, id),
            dir: HERE,
            id,
        }),
    );
    const isStarted =
        run('launchctl', ['bootstrap', getLaunchdDomain(), plistFile]) ||
        run('launchctl', ['load', '-w', plistFile]);
    if (!isStarted) {
        throw new Error('launchd did not take the agent');
    }
    console.log(`\nWhat it says: ${getLogFile(id)}`);
}

function uninstallMac(id) {
    const plistFile = getLaunchdPlistFile(id);
    if (
        !run('launchctl', [
            'bootout',
            `${getLaunchdDomain()}/${getLaunchdLabel(id)}`,
        ])
    ) {
        run('launchctl', ['unload', '-w', plistFile]);
    }
    removeFile(plistFile);
}

function statusMac(id) {
    const plistFile = getLaunchdPlistFile(id);
    const isInstalled = fs.existsSync(plistFile);
    console.log(`Installed: ${isInstalled ? plistFile : 'no'}`);
    if (isInstalled) {
        const isLoaded = ask('launchctl', [
            'print',
            `${getLaunchdDomain()}/${getLaunchdLabel(id)}`,
        ]).isOk;
        console.log(`Loaded:    ${isLoaded ? 'yes' : 'no'}`);
    }
}

function getWindowsUser() {
    const { username } = os.userInfo();
    const domain = process.env.USERDOMAIN;
    return domain ? `${domain}\\${username}` : username;
}

function installWindows(options, id) {
    const taskName = getTaskName(id);
    const xmlFile = path.join(os.tmpdir(), `${getServiceName(id)}-task.xml`);
    // schtasks reads its XML as UTF-16.
    writeFile(
        xmlFile,
        genTaskXml({
            node: process.execPath,
            script: TUNNEL_SCRIPT,
            tunnelArgs: withLog(options.tunnelArgs, id),
            dir: HERE,
            user: getWindowsUser(),
            everyMinutes: options.everyMinutes,
            id,
        }),
        'utf16le',
    );
    try {
        if (
            !run('schtasks', [
                '/Create',
                '/TN',
                taskName,
                '/XML',
                xmlFile,
                '/F',
            ])
        ) {
            throw new Error('Task Scheduler did not take the task');
        }
        run('schtasks', ['/Run', '/TN', taskName]);
    } finally {
        if (!isDryRun) {
            fs.rmSync(xmlFile, { force: true });
        }
    }
    console.log(`\nWhat it says: ${getLogFile(id)}`);
}

function uninstallWindows(id) {
    const taskName = getTaskName(id);
    run('schtasks', ['/End', '/TN', taskName]);
    run('schtasks', ['/Delete', '/TN', taskName, '/F']);
    // Windows has no polite stop for a program with no window: it is ended,
    // not closed, so nothing it wrote out or published is taken back.
    console.log(
        'It is ended without its goodbye: its two files stay where it wrote\n' +
            'them, and if it was publishing, take its server out of the registry:\n' +
            `  node llm-registry.mjs remove ${id}`,
    );
}

function statusWindows(id) {
    const taskName = getTaskName(id);
    const found = ask('schtasks', ['/Query', '/TN', taskName, '/FO', 'LIST']);
    console.log(`Installed: ${found.isOk ? taskName : 'no'}`);
    if (found.isOk) {
        console.log(found.text);
    }
}

const PLATFORMS = {
    linux: {
        install: installLinux,
        uninstall: uninstallLinux,
        status: statusLinux,
    },
    darwin: { install: installMac, uninstall: uninstallMac, status: statusMac },
    win32: {
        install: installWindows,
        uninstall: uninstallWindows,
        status: statusWindows,
    },
};

function main() {
    const options = readStartupArgs(process.argv.slice(2));
    if (options === null) {
        console.error(STARTUP_USAGE);
        process.exit(1);
    }
    const platform = PLATFORMS[process.platform];
    if (platform === undefined) {
        console.error(
            `No start-with-the-computer recipe for "${process.platform}" here.`,
        );
        process.exit(1);
    }
    const tunnelOptions = readArgs(options.tunnelArgs);
    if (tunnelOptions === null) {
        console.error(
            `These are not options llm-tunnel.mjs takes: ${options.tunnelArgs.join(' ')}\n`,
        );
        console.error(USAGE);
        process.exit(1);
    }
    // Which tunnel: named outright, else the one these options would start.
    const id = options.id || tunnelOptions.id;
    isDryRun = options.isDryRun;
    if (options.command === 'install') {
        platform.install(options, id);
        return;
    }
    if (options.command === 'uninstall') {
        platform.uninstall(id);
        endWhatIsLeft(id);
        return;
    }
    console.log(`Tunnel:    ${id}`);
    platform.status(id);
    const pid = findRunningTunnel(id);
    console.log(`Running:   ${pid === 0 ? 'no' : `yes (pid ${pid})`}`);
}

function checkIsRunDirectly() {
    try {
        return (
            process.argv[1] !== undefined &&
            fs.realpathSync.native(process.argv[1]) ===
                fs.realpathSync.native(fileURLToPath(import.meta.url))
        );
    } catch {
        return false;
    }
}

if (checkIsRunDirectly()) {
    try {
        main();
    } catch (error) {
        console.error(error?.message ?? error);
        process.exit(1);
    }
}
