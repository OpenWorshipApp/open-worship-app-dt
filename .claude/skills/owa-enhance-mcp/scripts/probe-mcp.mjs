// Exercises the owa-devtools-mcp firewall against the RUNNING app.
//
//   node .claude/skills/owa-enhance-mcp/scripts/probe-mcp.mjs
//   node .../probe-mcp.mjs --json
//
// It spawns a FRESH server over stdio rather than talking to the app's HTTP
// host, and that is the point: the host cached `server.mjs` on its first
// session and your edit is invisible to it until the app restarts (memory:
// `mcp-tool-edit-two-processes`). A fresh child process is the only way to see
// the policy you just wrote without killing the app you are testing against.
//
// What it does to the app: nothing it is not refused, plus one `owa_click` at
// a label deliberately chosen not to exist and one `owa_app_state` read. The
// destructive and code-execution attempts are the point of the run -- they are
// expected to be REFUSED, and a run where one of them succeeds is the failure
// this script exists to catch.
//
// Exit code: 0 when every check held, 1 when one did not or no app is running.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-mcp -> skills -> .claude|.github -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const BIN_PATH = path.join(
    REPO_ROOT,
    'tools',
    'owa-devtools-mcp',
    'bin.mjs',
);

const isJson = process.argv.slice(2).includes('--json');

function say(...items) {
    if (!isJson) {
        console.log(...items);
    }
}

function genClient() {
    const child = spawn(process.execPath, [BIN_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: REPO_ROOT,
    });
    const stderrLineList = [];
    child.stderr.on('data', (chunk) => {
        stderrLineList.push(String(chunk));
    });
    let buffer = '';
    const waiterMap = new Map();
    child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        let index = buffer.indexOf('\n');
        while (index !== -1) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            index = buffer.indexOf('\n');
            if (line === '') {
                continue;
            }
            let message;
            try {
                message = JSON.parse(line);
            } catch {
                continue;
            }
            const resolve = waiterMap.get(message.id);
            if (resolve !== undefined) {
                waiterMap.delete(message.id);
                resolve(message);
            }
        }
    });
    let lastId = 0;
    return {
        child,
        stderrLineList,
        send(method, params) {
            const id = (lastId += 1);
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    waiterMap.delete(id);
                    reject(new Error(`${method} timed out`));
                }, 30000);
                waiterMap.set(id, (message) => {
                    clearTimeout(timeoutId);
                    resolve(message);
                });
                child.stdin.write(
                    `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
                );
            });
        },
        notify(method, params) {
            child.stdin.write(
                `${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`,
            );
        },
    };
}

function toText(message) {
    return (
        message.result?.content
            ?.map((one) => {
                return one.text ?? '';
            })
            .join('\n') ?? ''
    );
}

const checkList = [];

function check(name, isHeld, detail) {
    checkList.push({ name, isHeld, detail });
    say(`  ${isHeld ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!isHeld) {
        say(`        ${detail}`);
    }
}

const client = genClient();
try {
    await client.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'owa-probe-mcp', version: '1' },
    });
    client.notify('notifications/initialized');

    const listed = await client.send('tools/list', {});
    const nameList = (listed.result?.tools ?? []).map((one) => {
        return one.name;
    });
    if (nameList.length === 0) {
        console.error(
            'No tools came back. Is the app running? Start it with ' +
                '`env -u ELECTRON_RUN_AS_NODE npm run dev`.',
        );
        client.child.kill();
        process.exit(1);
    }
    say(`\nTools listed   ${nameList.length}`);
    say(`Firewall       ${process.env.OWA_MCP_FIREWALL === 'off' ? 'OFF (env)' : 'strict'}\n`);

    say('Policy:');
    for (const denied of [
        'evaluate_script',
        'take_heapsnapshot',
        'upload_file',
    ]) {
        check(
            `${denied} is not offered`,
            !nameList.includes(denied),
            'it is still in tools/list, so the model pays for it and may call it',
        );
    }

    const call = (name, args) => {
        return client.send('tools/call', { name, arguments: args });
    };

    // The proven exploit: node reach from a page expression.
    const ran = await call('evaluate_script', {
        pageId: 0,
        function: "() => typeof require",
    });
    check(
        'evaluate_script is refused at the door',
        ran.result?.isError === true && !toText(ran).includes('function'),
        `it answered: ${toText(ran).slice(0, 120)}`,
    );

    const pressed = await call('owa_click', { find: 'Move to Trash' });
    check(
        'a press that cannot be undone is refused',
        pressed.result?.isError === true,
        `it answered: ${toText(pressed).slice(0, 120)}`,
    );
    check(
        'the refusal says what to do instead',
        toText(pressed).includes('owa_find_ui'),
        'the model is told no, but not what to do -- it will apologise, not adapt',
    );

    const sailed = await call('navigate_page', {
        pageId: 0,
        url: 'https://example.com',
    });
    check(
        'a page outside the app is refused',
        sailed.result?.isError === true,
        `it answered: ${toText(sailed).slice(0, 120)}`,
    );

    // Reload carries no address, so the allowlist used to have nothing to look
    // at and refused it -- an agent could not reload the window in front of
    // it. Read-only in effect: the page comes back where it was.
    const reloaded = await call('navigate_page', {
        pageId: 0,
        type: 'reload',
    });
    check(
        'reloading a page the app already shows is allowed',
        !toText(reloaded).includes('outside this app'),
        `it answered: ${toText(reloaded).slice(0, 120)}`,
    );

    // The other half of the job: ordinary work is untouched. A firewall that
    // also blocks the app working is not a safer app, it is a broken one.
    const ordinary = await call('owa_click', {
        find: 'No Control Is Named This',
    });
    check(
        'an ordinary press is not touched by the policy',
        ordinary.result?.isError !== true,
        `it answered: ${toText(ordinary).slice(0, 120)}`,
    );

    // The uid interlock (MC-02). The point-don't-press rule reads the LABEL a
    // press is aimed at, and chrome-devtools' own `click` carries none -- so
    // the label has to come from the snapshot that minted the uid. Probed
    // against the live window rather than a fixture, because the snapshot
    // format is chrome-devtools' and could change under us.
    // Resolved rather than assumed: `list_pages` numbers from 1, and the
    // refused calls above never reach the tool so they never had to know.
    const pageList = await call('list_pages', {});
    const pageId = Number(toText(pageList).match(/^(\d+): /m)?.[1] ?? 1);
    const snapshot = await call('take_snapshot', { pageId });
    const destructiveLine = toText(snapshot)
        .split('\n')
        .find((line) => {
            return (
                /^ *uid=\S+ +(?:button|menuitem|link|tab) /.test(line) &&
                /\b(?:delete|trash|erase|discard|remove|clear all)\b/i.test(
                    line,
                )
            );
        });
    if (destructiveLine === undefined) {
        check(
            'a control that cannot be undone is on screen to aim at',
            false,
            'nothing destructive is visible, so the uid interlock went untested',
        );
    } else {
        const uid = destructiveLine.match(/uid=(\S+)/)[1];
        // Nothing is pressed by this: it is the call the firewall must stop.
        const aimed = await call('click', { pageId, uid });
        check(
            'a press aimed by uid at what cannot be undone is refused',
            aimed.result?.isError === true &&
                toText(aimed).includes('press it themselves'),
            `${destructiveLine.trim().slice(0, 60)} -> ${toText(aimed).slice(0, 120)}`,
        );
    }
    // ...and the other half: a uid the snapshot never called destructive is
    // not the firewall's business. A uid that cannot exist proves it without
    // pressing anything -- the tool below refuses it for its own reasons.
    const strayUid = await call('click', { pageId, uid: '99_99999' });
    check(
        'an unremembered uid is not refused by the policy',
        !toText(strayUid).includes('press it themselves'),
        `it answered: ${toText(strayUid).slice(0, 120)}`,
    );

    // --- reaching OUT ------------------------------------------------
    //
    // `owa_read_website` is the one tool that opens a socket to somewhere the
    // model chose. The address policy has two layers and only a live run can
    // exercise the second: the firewall refuses what it can see synchronously,
    // and the main process resolves the name before it connects. The check
    // below that matters most is the third one -- a PUBLIC name that really
    // does resolve to 127.0.0.1, which no synchronous check could ever catch.
    const loopback = await call('owa_read_website', {
        url: 'https://127.0.0.1:39223/mcp',
    });
    check(
        "reading the app's own MCP door is refused",
        loopback.result?.isError === true &&
            toText(loopback).includes('local network'),
        `it answered: ${toText(loopback).slice(0, 120)}`,
    );

    const localFile = await call('owa_read_website', {
        url: 'file:///C:/Windows/win.ini',
    });
    check(
        'reading a file off the disk as a web page is refused',
        localFile.result?.isError === true &&
            toText(localFile).includes('Only https'),
        `it answered: ${toText(localFile).slice(0, 120)}`,
    );

    // `localtest.me` is a real domain on the public internet whose A record
    // is 127.0.0.1. It passes every check that can be made without asking
    // DNS, which is exactly why the DNS pass exists.
    const rebind = await call('owa_read_website', {
        url: 'https://localtest.me/',
    });
    check(
        'a public NAME that resolves to loopback is refused',
        rebind.result?.isError === true &&
            toText(rebind).includes('local network'),
        `it answered: ${toText(rebind).slice(0, 160)}`,
    );

    const read = await call('owa_app_state', {});
    check(
        'reading the app still works',
        read.result?.isError !== true && toText(read).includes('instances'),
        `it answered: ${toText(read).slice(0, 120)}`,
    );
} catch (error) {
    check('the probe ran', false, String(error?.message ?? error));
} finally {
    client.child.kill();
}

const failedList = checkList.filter((one) => {
    return !one.isHeld;
});
if (isJson) {
    console.log(
        JSON.stringify({ checks: checkList, failed: failedList.length }, null, 2),
    );
} else {
    say(
        `\n${checkList.length - failedList.length}/${checkList.length} held` +
            (failedList.length === 0 ? '' : ' -- see FAIL above'),
    );
}
process.exit(failedList.length === 0 ? 0 : 1);
