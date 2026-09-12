#!/usr/bin/env node
// The PACKAGED app for the owa-robot-test skill's prod mode: find the build
// electron-builder left under `release/`, check that it can open its CDP door,
// start it, and stop the one this script started -- never any other instance.
//
// Usage (run from the repo root):
//   node .claude/skills/owa-robot-test/scripts/prod-app.mjs <command> [options]
//
// Commands:
//   locate                Find the unpacked app for this OS + CPU under
//                         `release/`; print its exe, when it was built, the
//                         package version, and whether any source file is
//                         NEWER than the build (then rebuild before testing).
//   status                Every live instance from the discovery dir, with
//                         `isDev` and the exe behind its pid.
//   ai-status             Whether `<userData>/setting.json` has AI features ON.
//                         A packaged build with the key UNSET opens NO CDP
//                         endpoint (dev defaults to on; packaged to off).
//   enable-ai             Write `clientSetting["ai-enabled"] = "true"` into that
//                         file, keeping every other key. Refused while an
//                         instance on that userData is live: the app rewrites
//                         the file itself and would overwrite the edit.
//   launch                Start the located exe detached, with
//                         `ELECTRON_RUN_AS_NODE` and `NODE_ENV` stripped from
//                         the environment (VS Code's shell exports the first,
//                         which makes ANY Electron binary run as plain Node).
//                         Records pid + exe in `test-results/robot-test/
//                         prod-app.json` so `stop` can find exactly this one.
//   stop                  Quit the instance `launch` recorded (gracefully, then
//                         force after 8 s). Nothing else is ever killed.
//
// Options:
//   --user-data=<dir>     userData to run / check against instead of the
//                         packaged default (`%APPDATA%\open-worship-app`,
//                         `~/Library/Application Support/open-worship-app`,
//                         `~/.config/open-worship-app`). A scratch dir here
//                         starts the app with NO bibles, settings or content
//                         and its own single-instance lock.
//   --exe=<path>          launch: a specific executable instead of `locate`'s.
//   --json                Print machine-readable output only.
//
// Zero dependencies (Node 22+).

import { execFileSync, spawn } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readLiveInstances } from '../../../../tools/owa-devtools-mcp/discovery.mjs';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../..',
);
const RELEASE_DIR = path.join(REPO_ROOT, 'release');
// Prod mode deletes NOTHING outside `release/` (the user's rule, 2026-09-11):
// the record lives in there, and `removeInsideRelease` is the only way this
// script removes a file.
const RECORD_FILE_PATH = path.join(RELEASE_DIR, '.robot-test', 'prod-app.json');
// The scratch userData a prod run should use: everything the app writes --
// settings, bibles, documents, downloaded media, the Extra Binaries pack --
// follows userData on a fresh profile (`selected-parent-dir` unset falls back
// to `app.getPath('userData')`), so a run there never writes, and so never has
// to clean up, anything outside `release/`.
const SCRATCH_USER_DATA_PREFIX = 'robot-userdata-';

function checkIsInsideRelease(targetPath) {
    const relative = path.relative(RELEASE_DIR, path.resolve(targetPath));
    return (
        relative !== '' &&
        !relative.startsWith('..') &&
        !path.isAbsolute(relative)
    );
}

function removeInsideRelease(targetPath) {
    if (!checkIsInsideRelease(targetPath)) {
        fail(
            `Refusing to delete ${targetPath}: prod mode deletes nothing outside ` +
                `${RELEASE_DIR}.`,
        );
    }
    rmSync(targetPath, { recursive: true, force: true });
}
// Electron's `app.name` in the packaged build is package.json's `name`
// (electron-builder strips the `build` block, so no `productName` competes),
// which is what `app.getPath('userData')` is appended with.
const APP_DIR_NAME = 'open-worship-app';
const AI_ENABLED_SETTING_NAME = 'ai-enabled';
// Where a stale build would come from: anything the packaged app carries.
const SOURCE_DIRS = [
    'src',
    'electron',
    'html',
    'tools/owa-devtools-mcp',
    'docs/manual-sources',
    '.claude',
    'package.json',
];

const [command, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(
    rest.map((arg) => {
        const match = arg.match(/^--([^=]+)=(.*)$/);
        return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
    }),
);
const isJson = args.json === true;

function print(data, humanLines = []) {
    if (isJson || humanLines.length === 0) {
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
        return;
    }
    process.stdout.write(humanLines.join('\n') + '\n');
}

function fail(message, extra = {}) {
    process.stderr.write(`Error: ${message}\n`);
    if (isJson) {
        process.stdout.write(
            JSON.stringify({ error: message, ...extra }) + '\n',
        );
    }
    process.exit(1);
}

function readPackageJson() {
    return JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
    );
}

function getDefaultUserDataPath() {
    if (process.platform === 'win32') {
        return path.join(
            process.env.APPDATA ??
                path.join(os.homedir(), 'AppData', 'Roaming'),
            APP_DIR_NAME,
        );
    }
    if (process.platform === 'darwin') {
        return path.join(
            os.homedir(),
            'Library',
            'Application Support',
            APP_DIR_NAME,
        );
    }
    return path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
        APP_DIR_NAME,
    );
}

function getUserDataPath() {
    return typeof args['user-data'] === 'string'
        ? path.resolve(args['user-data'])
        : getDefaultUserDataPath();
}

/**
 * Where electron-builder unpacks for each OS + CPU, exact arch first. The
 * others are still listed so a build made for another CPU is reported as a
 * mismatch rather than as "no build".
 */
function listUnpackedCandidates() {
    const { arch, platform } = process;
    const packageJson = readPackageJson();
    const productName = packageJson.build?.productName ?? 'Open Worship app';
    const candidates = [];
    if (platform === 'win32') {
        const archDirs = {
            x64: 'win-unpacked',
            arm64: 'win-arm64-unpacked',
            ia32: 'win-ia32-unpacked',
        };
        for (const [dirArch, dirName] of Object.entries(archDirs)) {
            candidates.push({
                arch: dirArch,
                dir: path.join(RELEASE_DIR, dirName),
                exe: path.join(RELEASE_DIR, dirName, `${productName}.exe`),
            });
        }
    } else if (platform === 'darwin') {
        const archDirs = { x64: 'mac', arm64: 'mac-arm64' };
        for (const [dirArch, dirName] of Object.entries(archDirs)) {
            candidates.push({
                arch: dirArch,
                dir: path.join(RELEASE_DIR, dirName),
                exe: path.join(
                    RELEASE_DIR,
                    dirName,
                    `${productName}.app`,
                    'Contents',
                    'MacOS',
                    productName,
                ),
            });
        }
    } else {
        const archDirs = {
            x64: 'linux-unpacked',
            arm64: 'linux-arm64-unpacked',
            ia32: 'linux-ia32-unpacked',
        };
        for (const [dirArch, dirName] of Object.entries(archDirs)) {
            candidates.push({
                arch: dirArch,
                dir: path.join(RELEASE_DIR, dirName),
                exe: path.join(RELEASE_DIR, dirName, packageJson.name),
            });
        }
    }
    return candidates.sort((one, other) => {
        return (other.arch === arch) - (one.arch === arch);
    });
}

function newestMtimeUnder(targetPath) {
    let newest = { mtimeMs: 0, filePath: null };
    const visit = (currentPath) => {
        let stat;
        try {
            stat = statSync(currentPath);
        } catch {
            return;
        }
        if (stat.isDirectory()) {
            const baseName = path.basename(currentPath);
            if (baseName === 'node_modules' || baseName === '.histories') {
                return;
            }
            for (const name of readdirSync(currentPath)) {
                visit(path.join(currentPath, name));
            }
            return;
        }
        // A test file never ships, so editing one does not make a build stale
        // (it was reporting STALE for `aiChatSessionHelpers.test.ts`).
        if (/\.test\.[cm]?[jt]sx?$/.test(currentPath)) {
            return;
        }
        if (stat.mtimeMs > newest.mtimeMs) {
            newest = { mtimeMs: stat.mtimeMs, filePath: currentPath };
        }
    };
    visit(targetPath);
    return newest;
}

function locateBuild() {
    const candidates = listUnpackedCandidates();
    const found = candidates.find((candidate) => existsSync(candidate.exe));
    if (!found) {
        return {
            found: false,
            arch: process.arch,
            platform: process.platform,
            lookedFor: candidates.map((candidate) => candidate.exe),
        };
    }
    const builtAtMs = statSync(found.exe).mtimeMs;
    let newestSource = { mtimeMs: 0, filePath: null };
    for (const relativePath of SOURCE_DIRS) {
        const newest = newestMtimeUnder(path.join(REPO_ROOT, relativePath));
        if (newest.mtimeMs > newestSource.mtimeMs) {
            newestSource = newest;
        }
    }
    return {
        found: true,
        platform: process.platform,
        arch: process.arch,
        buildArch: found.arch,
        isArchMismatch: found.arch !== process.arch,
        dir: found.dir,
        exe: found.exe,
        version: readPackageJson().version,
        builtAt: new Date(builtAtMs).toISOString(),
        isStale: newestSource.mtimeMs > builtAtMs,
        newestSourceFile: newestSource.filePath
            ? path.relative(REPO_ROOT, newestSource.filePath)
            : null,
        newestSourceAt: newestSource.mtimeMs
            ? new Date(newestSource.mtimeMs).toISOString()
            : null,
    };
}

function readSettingJson(userDataPath) {
    const settingFilePath = path.join(userDataPath, 'setting.json');
    if (!existsSync(settingFilePath)) {
        return { settingFilePath, json: null };
    }
    return {
        settingFilePath,
        json: JSON.parse(readFileSync(settingFilePath, 'utf-8')),
    };
}

function readAiStatus(userDataPath) {
    const { settingFilePath, json } = readSettingJson(userDataPath);
    const value = json?.clientSetting?.[AI_ENABLED_SETTING_NAME] ?? null;
    // Mirrors `checkIsAiEnabled` in electron/aiHelpers.ts: only the strings
    // 'true' / 'false' count, and a packaged build with neither is OFF.
    const isEnabled = value === 'true';
    return {
        userDataPath,
        settingFilePath,
        settingFileExists: json !== null,
        value,
        isEnabled,
        note: isEnabled
            ? 'AI features are on: the packaged app will open its CDP endpoint.'
            : 'AI features are ' +
              (value === 'false'
                  ? 'OFF'
                  : 'UNSET, which a packaged build reads as OFF') +
              ': no CDP endpoint, nothing to drive. Run `enable-ai` with the app ' +
              'closed, or switch it on in Settings > Others and relaunch.',
    };
}

function readExecutablePath(pid) {
    try {
        if (process.platform === 'win32') {
            const output = execFileSync(
                'powershell',
                [
                    '-NoProfile',
                    '-Command',
                    `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ExecutablePath`,
                ],
                { encoding: 'utf-8', windowsHide: true },
            );
            return output.trim() || null;
        }
        const output = execFileSync('ps', ['-o', 'comm=', '-p', String(pid)], {
            encoding: 'utf-8',
        });
        return output.trim() || null;
    } catch {
        return null;
    }
}

function findLiveInstanceOn(userDataPath) {
    const wanted = path.resolve(userDataPath).toLowerCase();
    return (
        readLiveInstances().find((instance) => {
            return (
                typeof instance.userDataPath === 'string' &&
                path.resolve(instance.userDataPath).toLowerCase() === wanted
            );
        }) ?? null
    );
}

function checkIsProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === 'EPERM';
    }
}

function readRecord() {
    if (!existsSync(RECORD_FILE_PATH)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(RECORD_FILE_PATH, 'utf-8'));
    } catch {
        return null;
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

switch (command) {
    case 'locate': {
        const build = locateBuild();
        if (!build.found) {
            fail(
                `No packaged app for ${build.platform}/${build.arch} under release/. ` +
                    'Build one first: npm run pack:win | pack:mac | pack:linux.',
                build,
            );
        }
        print(build, [
            `exe:      ${build.exe}`,
            `version:  ${build.version} (package.json)`,
            `built at: ${build.builtAt}${build.isArchMismatch ? `  (built for ${build.buildArch}, this CPU is ${build.arch})` : ''}`,
            build.isStale
                ? `STALE: ${build.newestSourceFile} changed at ${build.newestSourceAt}, after the build. Rebuild before testing.`
                : 'up to date: no source file is newer than the build.',
        ]);
        break;
    }
    case 'status': {
        const instances = readLiveInstances().map((instance) => ({
            pid: instance.pid,
            isDev: instance.isDev === true,
            version: instance.version ?? null,
            port: instance.port,
            mcpUrl: instance.mcpUrl ?? null,
            userDataPath: instance.userDataPath ?? null,
            startedAt: instance.startedAt ?? null,
            exe: Number.isInteger(instance.pid)
                ? readExecutablePath(instance.pid)
                : null,
        }));
        print(
            { instances },
            instances.length === 0
                ? ['No live instance has published itself.']
                : instances.map((instance) => {
                      return (
                          `${instance.isDev ? 'DEV ' : 'PROD'} pid ${instance.pid} ` +
                          `v${instance.version} cdp ${instance.port} ` +
                          `userData ${instance.userDataPath}\n      exe ${instance.exe}`
                      );
                  }),
        );
        break;
    }
    case 'ai-status': {
        const status = readAiStatus(getUserDataPath());
        print(status, [
            `setting file: ${status.settingFilePath}${status.settingFileExists ? '' : ' (missing)'}`,
            `ai-enabled:   ${status.value ?? '(unset)'}`,
            status.note,
        ]);
        if (!status.isEnabled) {
            process.exit(2);
        }
        break;
    }
    case 'enable-ai': {
        const userDataPath = getUserDataPath();
        const live = findLiveInstanceOn(userDataPath);
        if (live !== null) {
            fail(
                `An instance (pid ${live.pid}) is running on ${userDataPath}; ` +
                    'it rewrites setting.json itself. Close it, then run this again ' +
                    '(or switch AI features on in its Settings > Others and relaunch).',
            );
        }
        const { settingFilePath, json } = readSettingJson(userDataPath);
        const next = json ?? {};
        next.clientSetting = { ...(next.clientSetting ?? {}) };
        const before = next.clientSetting[AI_ENABLED_SETTING_NAME] ?? null;
        next.clientSetting[AI_ENABLED_SETTING_NAME] = 'true';
        mkdirSync(userDataPath, { recursive: true });
        writeFileSync(settingFilePath, JSON.stringify(next));
        print(
            { settingFilePath, before, after: 'true', created: json === null },
            [
                `${json === null ? 'Created' : 'Updated'} ${settingFilePath}: ` +
                    `ai-enabled ${before ?? '(unset)'} -> true. ` +
                    'Restore it to what it was when the run is over.',
            ],
        );
        break;
    }
    case 'launch': {
        const build =
            typeof args.exe === 'string'
                ? { found: existsSync(args.exe), exe: path.resolve(args.exe) }
                : locateBuild();
        if (!build.found) {
            fail(
                `Executable not found: ${build.exe ?? 'no build under release/'}`,
            );
        }
        const userDataPath = getUserDataPath();
        const live = findLiveInstanceOn(userDataPath);
        if (live !== null) {
            fail(
                `An instance (pid ${live.pid}) already runs on ${userDataPath}; a ` +
                    'second one on the same userData loses the single-instance lock ' +
                    'and quits. Reuse it, stop it, or pass --user-data=<scratch dir>.',
            );
        }
        const aiStatus = readAiStatus(userDataPath);
        if (!aiStatus.isEnabled) {
            fail(aiStatus.note + ` (${aiStatus.settingFilePath})`);
        }
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        delete env.NODE_ENV;
        if (typeof args['user-data'] === 'string') {
            env.OWA_USER_DATA_PATH = userDataPath;
        }
        const child = spawn(build.exe, [], {
            cwd: path.dirname(build.exe),
            env,
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });
        child.unref();
        const record = {
            pid: child.pid,
            exe: build.exe,
            userDataPath,
            startedAt: new Date().toISOString(),
        };
        mkdirSync(path.dirname(RECORD_FILE_PATH), { recursive: true });
        writeFileSync(RECORD_FILE_PATH, JSON.stringify(record, null, 2));
        print(record, [
            `Started pid ${record.pid}: ${record.exe}`,
            `userData: ${userDataPath}`,
            `Recorded in ${RECORD_FILE_PATH}. Wait for its CDP door with:`,
            '  node .claude/skills/owa-robot-test/scripts/wait-for-debugger.mjs --prod --match=owa://local/ --timeout=90000',
        ]);
        break;
    }
    case 'stop': {
        const record = readRecord();
        if (record === null) {
            fail(
                `Nothing to stop: ${RECORD_FILE_PATH} is missing. Only an instance ` +
                    'started by `launch` is ever stopped here.',
            );
        }
        if (!checkIsProcessAlive(record.pid)) {
            print({ ...record, wasAlive: false }, [
                `pid ${record.pid} is already gone.`,
            ]);
            break;
        }
        // Same-exe check: a pid can be recycled by an unrelated process.
        const exeNow = readExecutablePath(record.pid);
        if (
            exeNow !== null &&
            path.resolve(exeNow).toLowerCase() !==
                path.resolve(record.exe).toLowerCase()
        ) {
            fail(
                `pid ${record.pid} is now ${exeNow}, not the app this script ` +
                    'started. Refusing to kill it.',
            );
        }
        if (process.platform === 'win32') {
            // No /F: WM_CLOSE reaches the windows and the app quits on its own,
            // running `will-quit` (which removes its discovery file).
            try {
                execFileSync('taskkill', ['/PID', String(record.pid), '/T'], {
                    stdio: 'ignore',
                    windowsHide: true,
                });
            } catch {
                // Falls through to the force below.
            }
        } else {
            try {
                process.kill(record.pid, 'SIGTERM');
            } catch {
                // Falls through to the force below.
            }
        }
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && checkIsProcessAlive(record.pid)) {
            await sleep(250);
        }
        let wasForced = false;
        if (checkIsProcessAlive(record.pid)) {
            wasForced = true;
            if (process.platform === 'win32') {
                execFileSync(
                    'taskkill',
                    ['/PID', String(record.pid), '/T', '/F'],
                    {
                        stdio: 'ignore',
                        windowsHide: true,
                    },
                );
            } else {
                process.kill(record.pid, 'SIGKILL');
            }
        }
        // A forced kill never runs `will-quit`, so the instance's published
        // file in the temp dir outlives it. It is NOT removed here: it is
        // outside `release/`, every reader skips a dead pid, and the app's own
        // sweep drops it on its next launch.
        removeInsideRelease(RECORD_FILE_PATH);
        print({ ...record, wasAlive: true, wasForced }, [
            `Stopped pid ${record.pid}${wasForced ? ' (forced after 8 s)' : ''}.`,
        ]);
        break;
    }
    default:
        process.stderr.write(
            'Usage: prod-app.mjs <locate|status|ai-status|enable-ai|launch|stop> ' +
                '[--user-data=<dir>] [--exe=<path>] [--json]\n',
        );
        process.exit(1);
}
