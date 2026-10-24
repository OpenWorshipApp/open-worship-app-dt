import { describe, expect, it } from 'vitest';

import {
    genCronLines,
    genLaunchdPlist,
    genSystemdUnit,
    genTaskXml,
    toTaskTime,
    getLaunchdLabel,
    getServiceName,
    getTaskName,
    readStartupArgs,
    toSystemdArg,
} from './llm-tunnel-startup.mjs';

const NODE = '/usr/bin/node';
const SCRIPT = '/home/church/app/extra-work/local-llm/llm-tunnel.mjs';
const DIR = '/home/church/app/extra-work/local-llm';
const ID = 'church-lmstudio';

describe('readStartupArgs', () => {
    it('keeps what follows -- for the tunnel', () => {
        expect(
            readStartupArgs([
                'install',
                '--every',
                '10',
                '--dry-run',
                '--',
                '--port',
                '11434',
                '--publish',
            ]),
        ).toEqual({
            command: 'install',
            everyMinutes: 10,
            isDryRun: true,
            id: '',
            tunnelArgs: ['--port', '11434', '--publish'],
        });
    });

    it('defaults to every five minutes and no tunnel options', () => {
        expect(readStartupArgs(['status'])).toEqual({
            command: 'status',
            everyMinutes: 5,
            isDryRun: false,
            id: '',
            tunnelArgs: [],
        });
    });

    it('takes the id of the tunnel to stop or ask about', () => {
        expect(readStartupArgs(['uninstall', '--id', ID]).id).toBe(ID);
        expect(readStartupArgs(['status', '--id', ID]).id).toBe(ID);
        // An installed tunnel's id is the one its own options give.
        expect(readStartupArgs(['install', '--id', ID])).toBeNull();
        expect(readStartupArgs(['uninstall', '--id', 'not a slug'])).toBeNull();
        expect(readStartupArgs(['uninstall', '--id'])).toBeNull();
    });

    it('refuses what it cannot read', () => {
        expect(readStartupArgs([])).toBeNull();
        expect(readStartupArgs(['start'])).toBeNull();
        expect(readStartupArgs(['install', '--port', '1234'])).toBeNull();
        expect(readStartupArgs(['install', '--every', '0'])).toBeNull();
        expect(readStartupArgs(['install', '--every', 'soon'])).toBeNull();
    });
});

describe('one service per tunnel', () => {
    it("puts the tunnel's id in every name an OS knows it by", () => {
        expect(getServiceName(ID)).toBe('owa-llm-tunnel-church-lmstudio');
        expect(getLaunchdLabel(ID)).toBe(
            'app.openworship.llm-tunnel.church-lmstudio',
        );
        expect(getTaskName(ID)).toBe(
            'Open Worship LLM Tunnel (church-lmstudio)',
        );
        expect(getServiceName('llm-11434')).not.toBe(getServiceName(ID));
    });
});

describe('Linux: a systemd user service', () => {
    it('quotes an argument, and doubles what systemd would read itself', () => {
        expect(toSystemdArg('/usr/bin/node')).toBe('"/usr/bin/node"');
        expect(toSystemdArg('Church LM Studio')).toBe('"Church LM Studio"');
        expect(toSystemdArg('say "hi" \\ 100% $HOME')).toBe(
            '"say \\"hi\\" \\\\ 100%% $$HOME"',
        );
    });

    it('starts the tunnel with its options and brings it back when it stops', () => {
        const unit = genSystemdUnit({
            node: NODE,
            script: SCRIPT,
            tunnelArgs: ['--port', '1234', '--name', 'Church LM Studio'],
            dir: DIR,
            id: ID,
        });
        expect(unit).toContain(
            `ExecStart="${NODE}" "${SCRIPT}" "--port" "1234" "--name" "Church LM Studio"\n`,
        );
        expect(unit).toContain('local LLM tunnel "church-lmstudio"');
        expect(unit).toContain(`WorkingDirectory=${DIR}\n`);
        expect(unit).toContain('Restart=always\n');
        expect(unit).toContain('[Install]\nWantedBy=default.target\n');
    });
});

describe('Linux with no systemd: cron', () => {
    it('starts at boot and again every few minutes', () => {
        expect(
            genCronLines({
                node: NODE,
                script: SCRIPT,
                tunnelArgs: ['--port', '1234'],
                everyMinutes: 5,
            }),
        ).toEqual([
            `@reboot '${NODE}' '${SCRIPT}' '--port' '1234'`,
            `*/5 * * * * '${NODE}' '${SCRIPT}' '--port' '1234'`,
        ]);
    });

    it("escapes a quote for the shell and a % for cron's own reading", () => {
        const [line] = genCronLines({
            node: NODE,
            script: SCRIPT,
            tunnelArgs: ['--name', "St Mary's 100%"],
            everyMinutes: 60,
        });
        expect(line).toContain("'St Mary'\\''s 100\\%'");
    });

    it('runs hourly when asked for an hour or more', () => {
        expect(
            genCronLines({
                node: NODE,
                script: SCRIPT,
                tunnelArgs: [],
                everyMinutes: 90,
            })[1].startsWith('0 * * * * '),
        ).toBe(true);
    });
});

describe('macOS: a launchd agent', () => {
    it('runs at login, is kept alive, and escapes what XML reads itself', () => {
        const plist = genLaunchdPlist({
            node: '/opt/homebrew/bin/node',
            script: '/Users/church/R&D <app>/llm-tunnel.mjs',
            tunnelArgs: ['--name', 'Church "A"'],
            dir: '/Users/church/R&D <app>',
            id: ID,
        });
        expect(plist).toContain(
            '<string>app.openworship.llm-tunnel.church-lmstudio</string>',
        );
        expect(plist).toContain(
            '<string>/Users/church/R&amp;D &lt;app&gt;/llm-tunnel.mjs</string>',
        );
        expect(plist).toContain('<string>Church &quot;A&quot;</string>');
        expect(plist).toContain('<key>RunAtLoad</key>\n    <true/>');
        expect(plist).toContain('<key>KeepAlive</key>\n    <true/>');
    });
});

describe('Windows: a Task Scheduler task', () => {
    const xml = genTaskXml({
        node: 'C:\\Program Files\\nodejs\\node.exe',
        script: "D:\\apps\\St Mary's\\llm-tunnel.mjs",
        tunnelArgs: ['--name', 'Church & Co'],
        dir: "D:\\apps\\St Mary's",
        user: 'CHURCH-PC\\reng',
        everyMinutes: 5,
        id: ID,
        startAt: '2026-10-15T12:31:05',
    });

    // Installed in the middle of a session -- which is how it always is --
    // a logon trigger alone ran once and never again until the next logon.
    it('also repeats from the moment it is installed, for good', () => {
        const trigger = xml.slice(
            xml.indexOf('<TimeTrigger>'),
            xml.indexOf('</TimeTrigger>'),
        );
        expect(trigger).toContain('<Interval>PT5M</Interval>');
        expect(trigger).toContain(
            '<StopAtDurationEnd>false</StopAtDurationEnd>',
        );
        // No Duration: the pattern repeats with no end.
        expect(trigger).not.toContain('<Duration>');
        expect(trigger).toContain(
            '<StartBoundary>2026-10-15T12:31:05</StartBoundary>',
        );
        // The schema wants the repetition first, then the start.
        expect(trigger.indexOf('<Repetition>')).toBeLessThan(
            trigger.indexOf('<StartBoundary>'),
        );
        expect(trigger.indexOf('<StartBoundary>')).toBeLessThan(
            trigger.indexOf('<Enabled>true'),
        );
        // Both triggers, in the one Triggers block.
        expect(xml.indexOf('</LogonTrigger>')).toBeLessThan(
            xml.indexOf('<TimeTrigger>'),
        );
        expect(xml.indexOf('</TimeTrigger>')).toBeLessThan(
            xml.indexOf('</Triggers>'),
        );
    });

    it('writes a time the way Task Scheduler reads one: local, no zone', () => {
        expect(toTaskTime(new Date(2026, 0, 5, 7, 8, 9))).toBe(
            '2026-01-05T07:08:09',
        );
    });

    it("starts at this user's logon and repeats for good", () => {
        const trigger = xml.slice(
            xml.indexOf('<LogonTrigger>'),
            xml.indexOf('</LogonTrigger>'),
        );
        expect(trigger).toContain('<Interval>PT5M</Interval>');
        expect(trigger).toContain(
            '<StopAtDurationEnd>false</StopAtDurationEnd>',
        );
        // The schema wants the repetition before the trigger's own fields.
        const order = ['<Repetition>', '<Enabled>true', '<UserId>CHURCH-PC'];
        expect(
            order.map((part) => {
                return trigger.indexOf(part) !== -1;
            }),
        ).toEqual([true, true, true]);
        expect(
            order
                .map((part) => {
                    return trigger.indexOf(part);
                })
                .toSorted((one, other) => {
                    return one - other;
                }),
        ).toEqual(
            order.map((part) => {
                return trigger.indexOf(part);
            }),
        );
        expect(xml).toContain(
            '<Principal id="Author">\r\n      <UserId>CHURCH-PC\\reng</UserId>',
        );
    });

    it('drops a start that finds it running, and never times it out', () => {
        expect(xml).toContain(
            '<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
        );
        expect(xml).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
    });

    it('runs node with no window, every argument quoted for PowerShell and XML', () => {
        expect(xml).toContain('<Command>powershell.exe</Command>');
        expect(xml).toContain(
            "<Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -Command &quot;&amp; 'C:\\Program Files\\nodejs\\node.exe' 'D:\\apps\\St Mary''s\\llm-tunnel.mjs' '--name' 'Church &amp; Co'&quot;</Arguments>",
        );
    });

    it('says which tunnel it is, in the document schtasks reads', () => {
        expect(
            xml.startsWith('<?xml version="1.0" encoding="UTF-16"?>\r\n'),
        ).toBe(true);
        expect(xml).toContain('local LLM tunnel &quot;church-lmstudio&quot;');
    });
});
