// llm-registry.mjs
// Looks after the shared registry on the site -- the servers every copy of
// the app is offered (docs/llm-registry/README.md):
//
//   node extra-work/local-llm/llm-registry.mjs list
//       the servers shared right now, read from the public file
//   node extra-work/local-llm/llm-registry.mjs check [--remove-unreachable]
//       asks each server whether it answers; for one that does not, asks you
//       whether to take it out (or takes them all out, with the option)
//   node extra-work/local-llm/llm-registry.mjs remove <id> [--yes]
//       takes one server out
//   node extra-work/local-llm/llm-registry.mjs add
//       opens a new entry in vim ($VISUAL or $EDITOR when set) as a
//       temporary JSON file of placeholders; once the editor is closed it is
//       checked -- no id and no name another entry has -- shown, and added
//       after a yes
//   node extra-work/local-llm/llm-registry.mjs modify <id> [<entry.json>]
//       opens that entry in the editor the same way -- or reads it, as it is
//       to be, from the file -- and changes it where it stands after the
//       same check and a yes
//
// `list` and `check` need nothing but the internet. Taking a server out,
// adding or changing one writes the registry, which needs this repo's
// `node_modules` and `extra-work/.env`, like `s3-push-llm-registry.mjs`. A
// key is never printed.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import {
    MAX_SERVERS,
    PUBLIC_URL,
    findRegistryProblems,
    publishRegistry,
    readPublishedRegistry,
} from './s3-push-llm-registry.mjs';

const CHECK_TIMEOUT_MILLISECOND = 10000;
const ID_PATTERN = /^[A-Za-z0-9-]{1,48}$/;
// The app's own cuts (electron/customLlmProtocol.ts).
const NAME_MAX = 60;
const URL_MAX = 500;
const KEY_MAX = 4096;
const MODEL_MAX = 200;

export const REGISTRY_USAGE = [
    'Usage: node llm-registry.mjs list',
    '       node llm-registry.mjs check [--remove-unreachable]',
    '       node llm-registry.mjs remove <id> [--yes]',
    '       node llm-registry.mjs add',
    '       node llm-registry.mjs modify <id> [<entry.json>]',
    '',
    '  list    the servers shared right now',
    '  check   asks each one whether it answers, and for one that does not',
    '          asks whether to take it out; --remove-unreachable takes them',
    '          all out without asking',
    '  remove  takes one server out, by its id; --yes does not ask first',
    '  add     opens a new entry in vim ($VISUAL or $EDITOR when set); once',
    '          it is closed, checks it, shows it and asks before adding it',
    '  modify  opens one server, by its id, in the editor the same way -- or',
    '          reads it as changed from <entry.json> -- checks it, shows it and',
    '          asks before changing it',
].join('\n');

/** The command and its options, or null when they cannot be read. */
export function readRegistryArgs(argv) {
    const options = {
        command: argv[0] ?? '',
        id: '',
        filePath: '',
        isRemovingUnreachable: false,
        isYes: false,
    };
    let isBad = !['list', 'check', 'remove', 'add', 'modify'].includes(
        options.command,
    );
    const isTakingId = ['remove', 'modify'].includes(options.command);
    for (const arg of argv.slice(1)) {
        if (arg === '--remove-unreachable' && options.command === 'check') {
            options.isRemovingUnreachable = true;
        } else if (arg === '--yes' && options.command === 'remove') {
            options.isYes = true;
        } else if (isTakingId && options.id === '' && ID_PATTERN.test(arg)) {
            options.id = arg;
        } else if (
            options.command === 'modify' &&
            options.id !== '' &&
            options.filePath === '' &&
            !arg.startsWith('--')
        ) {
            options.filePath = arg;
        } else {
            isBad = true;
        }
    }
    if (isBad || (isTakingId && options.id === '')) {
        return null;
    }
    return options;
}

function listServers(registry) {
    return Array.isArray(registry?.servers)
        ? registry.servers.filter((server) => {
              return server !== null && typeof server === 'object';
          })
        : [];
}

/** A server as two or three lines to print. Says whether it has a key, never which. */
export function describeServer(server) {
    const models = (Array.isArray(server.models) ? server.models : [])
        .map((model) => {
            return model?.model;
        })
        .filter((model) => {
            return typeof model === 'string';
        });
    return [
        `  ${server.id}   ${server.name ?? ''}`,
        `      ${server.baseUrl ?? ''}   key: ${server.apiKey ? 'yes' : 'none'}${server.isFree === true ? '   free' : ''}`,
        // Not an assistant: the app posts its problem reports there and
        // shows it in no list.
        server.isAcceptingReport === true && models.length === 0
            ? '      takes reports (not offered as an assistant)'
            : `      models: ${models.length === 0 ? '(none)' : models.join(', ')}${server.isAcceptingReport === true ? '   also takes reports' : ''}`,
    ];
}

// An address of somebody's own network: it answers there and nowhere else,
// which is not the same as a server that is gone.
export function checkIsLocalAddress(baseUrl) {
    let host;
    try {
        host = new URL(baseUrl).hostname.toLowerCase();
    } catch {
        return false;
    }
    return (
        host === 'localhost' ||
        !host.includes('.') ||
        /\.(local|lan|home|internal)$/.test(host) ||
        /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
            host,
        )
    );
}

/**
 * Whether an address that takes reports is there. It has no model list to
 * ask for, and a check must not file a report of its own: the address is
 * asked with a GET, and anything it answers itself -- a 404 or a 405 from a
 * door that only takes a POST included -- says something is listening. A
 * 5xx is what a tunnel with nothing behind it answers.
 */
async function checkReportServer(server, baseUrl, fetchUrl) {
    try {
        const response = await fetchUrl(baseUrl, {
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MILLISECOND),
            headers: server.apiKey
                ? { authorization: `Bearer ${server.apiKey}` }
                : {},
            redirect: 'manual',
        });
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) {
            return {
                isReachable: true,
                detail: `takes reports; answers, but refuses the key in the registry (${response.status})`,
            };
        }
        return response.status < 500
            ? {
                  isReachable: true,
                  detail: `takes reports; answers (${response.status} to a GET — no report was sent to try it)`,
              }
            : { isReachable: false, detail: `answered ${response.status}` };
    } catch (error) {
        return {
            isReachable: false,
            detail: describeNoAnswer(error, baseUrl),
        };
    }
}

function describeNoAnswer(error, baseUrl) {
    const reason =
        error?.name === 'TimeoutError'
            ? `no answer in ${CHECK_TIMEOUT_MILLISECOND / 1000} s`
            : `could not be reached (${error?.cause?.code ?? error?.message ?? error})`;
    return checkIsLocalAddress(baseUrl)
        ? `${reason} — a local-network address, which answers only on its own network`
        : reason;
}

/**
 * Whether a shared server answers: its model list is asked for with the key
 * the registry carries. A server that answers and refuses that key is there
 * -- the entry is wrong, not the server gone -- and is said so.
 */
export async function checkSharedServer(server, fetchUrl = fetch) {
    const baseUrl = String(server?.baseUrl ?? '').replace(/\/+$/, '');
    // One that is an assistant as well is asked the assistant's way: the
    // same door answers both.
    if (
        server?.isAcceptingReport === true &&
        !(Array.isArray(server.models) && server.models.length > 0)
    ) {
        return checkReportServer(server, baseUrl, fetchUrl);
    }
    try {
        const response = await fetchUrl(`${baseUrl}/models`, {
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MILLISECOND),
            headers: {
                accept: 'application/json',
                ...(server.apiKey
                    ? { authorization: `Bearer ${server.apiKey}` }
                    : {}),
            },
            redirect: 'manual',
        });
        await response.body?.cancel();
        if (response.ok) {
            return { isReachable: true, detail: 'answers' };
        }
        if (response.status === 401 || response.status === 403) {
            return {
                isReachable: true,
                detail: `answers, but refuses the key in the registry (${response.status})`,
            };
        }
        return { isReachable: false, detail: `answered ${response.status}` };
    } catch (error) {
        return {
            isReachable: false,
            detail: describeNoAnswer(error, baseUrl),
        };
    }
}

/** The registry without the servers carrying these ids; every other one as it is. */
export function removeServers(registry, ids, today) {
    return {
        version: 1,
        updated: today,
        servers: listServers(registry).filter((server) => {
            return !ids.includes(server.id);
        }),
    };
}

/** The registry with this server added at the end; every other one as it is. */
export function addServer(registry, server, today) {
    return {
        version: 1,
        updated: today,
        servers: [...listServers(registry), server],
    };
}

/** The registry with the server carrying `id` replaced where it stands; every other one as it is. */
export function replaceServer(registry, id, server, today) {
    return {
        version: 1,
        updated: today,
        servers: listServers(registry).map((one) => {
            return one.id === id ? server : one;
        }),
    };
}

/**
 * The file `add` opens in the editor: the entry, every text a placeholder
 * in `<...>` saying what goes there. A placeholder left in an optional field
 * leaves that field out, and the model row left as it is names no model --
 * which an entry that only takes reports wants.
 */
export const NEW_SERVER_TEMPLATE = `${JSON.stringify(
    {
        id: '<a slug no other entry has: letters, digits and -, up to 48>',
        name: '<what the Assistant picker shows, no other entry has it, up to 60 characters>',
        note: '<optional: shown to the person choosing it, up to 300 characters>',
        baseUrl: '<the OpenAI-compatible address, e.g. https://example.com/v1>',
        apiKey: '<optional: sent as a Bearer token -- PUBLIC once added>',
        isFree: false,
        isAcceptingReport: false,
        models: [
            {
                model: '<the model id the server knows, e.g. qwen/qwen3.5-9b>',
                name: '<optional: what the Model picker shows>',
                canSeeImages: false,
                note: "<optional: this model's word to the person choosing it>",
            },
        ],
    },
    null,
    4,
)}\n`;

/**
 * The file `modify` opens: the entry as the registry holds it, with the
 * template's placeholder in each field it leaves out -- there to be filled
 * in -- and the template's model row when it names no model.
 */
export function toEditableText(server) {
    const template = JSON.parse(NEW_SERVER_TEMPLATE);
    const [modelTemplate] = template.models;
    const models =
        Array.isArray(server.models) && server.models.length > 0
            ? server.models.map((model) => {
                  return model !== null &&
                      typeof model === 'object' &&
                      !Array.isArray(model)
                      ? { ...modelTemplate, ...model }
                      : model;
              })
            : template.models;
    return `${JSON.stringify({ ...template, ...server, models }, null, 4)}\n`;
}

const PLACEHOLDER_PATTERN = /^<[^]*>$/;

function checkIsBlank(value) {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' &&
            (value.trim() === '' || PLACEHOLDER_PATTERN.test(value.trim())))
    );
}

function toTrimmed(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function readFlag(value, label, problems) {
    if (value !== undefined && typeof value !== 'boolean') {
        problems.push(`"${label}" must be true or false`);
    }
    return value === true;
}

function checkLength(value, label, max, problems) {
    if (!checkIsBlank(value) && String(value).length > max) {
        problems.push(`"${label}" is over ${max} characters: the app cuts it`);
    }
}

function readNewModels(models, problems) {
    if (models === undefined || models === null) {
        return [];
    }
    if (!Array.isArray(models)) {
        problems.push('"models" must be a list');
        return [];
    }
    const kept = [];
    models.forEach((item, index) => {
        const where = `models[${index}]`;
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            problems.push(`"${where}" must be an object`);
            return;
        }
        const { model, name, canSeeImages, note, ...rest } = item;
        if (checkIsBlank(model)) {
            // The row left as the template has it: no model meant.
            if (!checkIsBlank(name) || !checkIsBlank(note)) {
                problems.push(`"${where}.model" is not filled in`);
            }
            return;
        }
        const one = {
            model: toTrimmed(model),
            ...(checkIsBlank(name) ? {} : { name: toTrimmed(name) }),
            ...(readFlag(canSeeImages, `${where}.canSeeImages`, problems)
                ? { canSeeImages: true }
                : {}),
            ...(checkIsBlank(note) ? {} : { note: toTrimmed(note) }),
            ...rest,
        };
        checkLength(one.model, `${where}.model`, MODEL_MAX, problems);
        checkLength(one.name, `${where}.name`, NAME_MAX, problems);
        kept.push(one);
    });
    return kept;
}

/**
 * What already in the registry the server would stand beside: an entry with
 * its id, or with its name -- two in the Assistant picker under one name
 * cannot be told apart. Neither is told apart by case.
 */
export function findDuplicateProblems(server, servers) {
    const problems = [];
    const toKey = (value) => {
        return typeof value === 'string' && value.trim() !== ''
            ? value.trim().toLowerCase()
            : null;
    };
    const sameId = servers.find((one) => {
        return toKey(one.id) !== null && toKey(one.id) === toKey(server.id);
    });
    if (sameId !== undefined) {
        problems.push(
            `id "${server.id}" is already in the registry ("${sameId.name ?? ''}"): choose another`,
        );
    }
    const sameName = servers.find((one) => {
        return (
            toKey(one.name) !== null && toKey(one.name) === toKey(server.name)
        );
    });
    if (sameName !== undefined) {
        problems.push(
            `name "${server.name}" is already used by "${sameName.id}": choose another`,
        );
    }
    return problems;
}

/**
 * The entry as the editor left it, cleaned the way it will be published --
 * text trimmed, a placeholder or a false left out -- and what is wrong with
 * it: the app's own rules (`findRegistryProblems`), its cuts, and an id or a
 * name another entry of `servers` has.
 */
export function readNewServer(text, servers) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        return { server: null, problems: [`not JSON: ${error.message}`] };
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return {
            server: null,
            problems: ['the entry must be one JSON object, { ... }'],
        };
    }
    const problems = [];
    const {
        id,
        name,
        baseUrl,
        apiKey,
        isFree,
        note,
        isAcceptingReport,
        models,
        ...rest
    } = data;
    const unfilled = Object.entries({ id, name, baseUrl })
        .filter(([, value]) => {
            return checkIsBlank(value);
        })
        .map(([key]) => {
            return key;
        });
    for (const key of unfilled) {
        problems.push(`"${key}" is not filled in`);
    }
    const isFreeFlag = readFlag(isFree, 'isFree', problems);
    const isReportFlag = readFlag(
        isAcceptingReport,
        'isAcceptingReport',
        problems,
    );
    const modelList = readNewModels(models, problems);
    const server = {
        id: toTrimmed(id),
        name: toTrimmed(name),
        baseUrl: toTrimmed(baseUrl),
        ...(checkIsBlank(apiKey) ? {} : { apiKey: toTrimmed(apiKey) }),
        ...(isFreeFlag ? { isFree: true } : {}),
        ...(checkIsBlank(note) ? {} : { note: toTrimmed(note) }),
        ...(isReportFlag ? { isAcceptingReport: true } : {}),
        ...(modelList.length > 0 ? { models: modelList } : {}),
        ...rest,
    };
    checkLength(server.name, 'name', NAME_MAX, problems);
    checkLength(server.baseUrl, 'baseUrl', URL_MAX, problems);
    checkLength(server.apiKey, 'apiKey', KEY_MAX, problems);
    // Said once: a field not filled in is not also said to be wrong.
    for (const problem of findRegistryProblems({
        version: 1,
        servers: [server],
    })) {
        const said = problem.replace(/^servers\[0\]\./, '');
        if (
            !unfilled.some((key) => {
                return said.startsWith(`${key} `);
            })
        ) {
            problems.push(said);
        }
    }
    problems.push(...findDuplicateProblems(server, servers));
    return { server, problems };
}

async function readPublicRegistry(fetchUrl) {
    const response = await fetchUrl(PUBLIC_URL, {
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MILLISECOND),
        headers: { accept: 'application/json' },
        cache: 'no-store',
    });
    if (!response.ok) {
        throw new Error(`${PUBLIC_URL} answered ${response.status}`);
    }
    try {
        return JSON.parse(await response.text());
    } catch {
        // The site answers its own page for a file that is not there.
        throw new Error(
            `${PUBLIC_URL} is not a registry: nothing is published`,
        );
    }
}

async function askYesNo(question) {
    const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const answer = await prompt.question(`${question} [y/N] `);
        return /^y(es)?$/i.test(answer.trim());
    } finally {
        prompt.close();
    }
}

/**
 * Opens `text` in the editor as a temporary JSON file and answers what it
 * holds once the editor is closed, or null when the editor ended with a
 * failure (`:cq` in vim). The file is deleted either way: it can carry a key.
 */
function editInEditor(text) {
    const editor = process.env.VISUAL || process.env.EDITOR || 'vim';
    const dirPath = fs.mkdtempSync(
        path.join(os.tmpdir(), 'owa-llm-registry-add-'),
    );
    const filePath = path.join(dirPath, 'new-server.json');
    try {
        fs.writeFileSync(filePath, text, { mode: 0o600 });
        // Through the shell, as git does: an editor can come with options
        // ("code --wait").
        const result = spawnSync(`${editor} "${filePath}"`, {
            shell: true,
            stdio: 'inherit',
        });
        // 127 from sh: no such command. cmd.exe answers 1 for one, as vim's
        // `:cq` does, and says "is not recognized" itself.
        if (result.error || result.status === 127) {
            throw new Error(
                `The editor "${editor}" could not be started: install vim, or set EDITOR to the editor to use`,
            );
        }
        return result.status === 0 ? fs.readFileSync(filePath, 'utf-8') : null;
    } finally {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

const realDeps = {
    fetchUrl: (url, init) => {
        return fetch(url, init);
    },
    readPublished: readPublishedRegistry,
    publish: publishRegistry,
    ask: askYesNo,
    edit: editInEditor,
    readFile: (filePath) => {
        return fs.readFileSync(path.resolve(filePath), 'utf-8');
    },
    print: (text = '') => {
        console.log(text);
    },
    isInteractive: () => {
        return process.stdin.isTTY === true && process.stdout.isTTY === true;
    },
    today: () => {
        return new Date().toISOString().slice(0, 10);
    },
};

// Takes the servers out of the registry the bucket holds this moment -- not
// of the copy just listed, which a tunnel may have changed since.
async function takeOut(ids, deps) {
    const live = await deps.readPublished();
    const found = listServers(live).filter((server) => {
        return ids.includes(server.id);
    });
    if (found.length === 0) {
        deps.print('Nothing to take out: the registry no longer has it.');
        return;
    }
    await deps.publish(removeServers(live, ids, deps.today()), deps.print);
    deps.print(
        `Taken out: ${found
            .map((server) => {
                return server.id;
            })
            .join(', ')}. The app shows it after its next reload.`,
    );
}

const EDIT_HINT =
    'Fill in the entry, then save and quit (:wq in vim). A <placeholder> left in an optional field leaves that field out; quitting with no change (:q!) leaves the registry as it is.';

function toShownServer(server) {
    return server.apiKey ? { ...server, apiKey: '(set — not shown)' } : server;
}

function printProblems(problems, deps) {
    deps.print('The entry is not right yet:');
    for (const problem of problems) {
        deps.print(`  - ${problem}`);
    }
}

// Opens `text` in the editor until the entry in it is right or let go: the
// entry, or null once it is said that nothing was `verb` (added, changed).
async function editUntilRight(text, others, verb, deps) {
    let shown = text;
    for (;;) {
        deps.print(EDIT_HINT);
        const edited = await deps.edit(shown);
        if (edited === null) {
            deps.print(`Nothing ${verb}: the editor ended with a failure.`);
            return null;
        }
        if (edited.trim() === '' || edited === shown) {
            deps.print(`Nothing ${verb}.`);
            return null;
        }
        const { server, problems } = readNewServer(edited, others);
        if (problems.length === 0) {
            return server;
        }
        printProblems(problems, deps);
        if (!(await deps.ask('Edit it again?'))) {
            deps.print(`Nothing ${verb}.`);
            return null;
        }
        shown = edited;
    }
}

// Shows the entry -- never its key -- and whether it answers, and asks.
async function askToWrite(server, heading, question, verb, deps) {
    deps.print('');
    deps.print(heading);
    for (const line of JSON.stringify(toShownServer(server), null, 4).split(
        '\n',
    )) {
        deps.print(`  ${line}`);
    }
    deps.print('Asking it whether it answers...');
    const answer = await checkSharedServer(server, deps.fetchUrl);
    deps.print(
        `  ${answer.isReachable ? 'reachable' : 'UNREACHABLE'} — ${answer.detail}`,
    );
    if (await deps.ask(question)) {
        return true;
    }
    deps.print(`Nothing ${verb}.`);
    return false;
}

function findChangedFields(before, after) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (key) => {
            return JSON.stringify(before[key]) !== JSON.stringify(after[key]);
        },
    );
}

// Opens the new entry in the editor until it is right or let go, shows it,
// and adds it after a yes -- to the registry the bucket holds THEN, read
// again: a tunnel may have written it while the editor was open.
async function addNew(deps) {
    if (!deps.isInteractive()) {
        deps.print(
            'Not asked here (no terminal): run add in a terminal, where the editor can open.',
        );
        return 1;
    }
    // Read before the editor opens: a missing credential is said now, not
    // after the entry is typed.
    const servers = listServers(await deps.readPublished());
    if (servers.length >= MAX_SERVERS) {
        deps.print(
            `The registry already holds ${servers.length} servers, the most the app reads: take one out first.`,
        );
        return 1;
    }
    const server = await editUntilRight(
        NEW_SERVER_TEMPLATE,
        servers,
        'added',
        deps,
    );
    if (
        server === null ||
        !(await askToWrite(
            server,
            'The new entry:',
            `Add "${server.name}" (${server.id}) to the shared registry?`,
            'added',
            deps,
        ))
    ) {
        return 0;
    }
    const live = await deps.readPublished();
    const clashes = findDuplicateProblems(server, listServers(live));
    if (listServers(live).length >= MAX_SERVERS) {
        clashes.push(
            `it holds ${MAX_SERVERS} servers now, the most the app reads`,
        );
    }
    if (clashes.length > 0) {
        deps.print(
            `Not added — the registry changed meanwhile: ${clashes.join('; ')}.`,
        );
        return 1;
    }
    await deps.publish(addServer(live, server, deps.today()), deps.print);
    deps.print(
        `Added: ${server.id}. The app shows it after its next reload.`,
    );
    return 0;
}

// Changes one entry where it stands: as the editor leaves it, or as a file
// says it is to be. Its own id and name are no clash; another entry's are.
// Written to the registry the bucket holds after the yes, and only while
// the entry there is still the one that was opened -- a tunnel rewrites its
// own when its address or its models change.
async function modifyOne(id, filePath, deps) {
    if (!deps.isInteractive()) {
        deps.print(
            `Not asked here (no terminal): run modify in a terminal${filePath === '' ? ', where the editor can open' : ''}.`,
        );
        return 1;
    }
    const servers = listServers(await deps.readPublished());
    const before = servers.find((one) => {
        return one.id === id;
    });
    if (before === undefined) {
        deps.print(`"${id}" is not in the registry: list shows the ids.`);
        return 1;
    }
    const others = servers.filter((one) => {
        return one !== before;
    });
    const editable = toEditableText(before);
    // The entry as it is, read the way an edited one is: what "changed" is
    // measured against.
    const { server: baseline } = readNewServer(editable, others);
    let server;
    if (filePath === '') {
        server = await editUntilRight(editable, others, 'changed', deps);
        if (server === null) {
            return 0;
        }
    } else {
        let text;
        try {
            text = await deps.readFile(filePath);
        } catch (error) {
            deps.print(
                `Nothing changed: ${filePath} cannot be read (${error?.code ?? error?.message ?? error}).`,
            );
            return 1;
        }
        const result = readNewServer(text, others);
        if (result.problems.length > 0) {
            printProblems(result.problems, deps);
            deps.print(`Nothing changed: fix ${filePath} and run it again.`);
            return 1;
        }
        server = result.server;
    }
    const changed = findChangedFields(baseline, server);
    if (changed.length === 0) {
        deps.print('Nothing changed: the entry is as the registry holds it.');
        return 0;
    }
    if (server.id !== id) {
        deps.print(
            `The id changes from "${id}": the app knows a server by its id, so to a copy that picked "${id}" this is a new one.`,
        );
    }
    if (
        !(await askToWrite(
            server,
            `The entry, changed (${changed.join(', ')}):`,
            `Change "${before.name ?? id}" (${id}) in the shared registry?`,
            'changed',
            deps,
        ))
    ) {
        return 0;
    }
    const live = await deps.readPublished();
    const liveServers = listServers(live);
    const now = liveServers.find((one) => {
        return one.id === id;
    });
    if (now === undefined || JSON.stringify(now) !== JSON.stringify(before)) {
        deps.print(
            `Not changed — "${id}" was ${now === undefined ? 'taken out' : 'changed'} meanwhile: run modify again.`,
        );
        return 1;
    }
    const clashes = findDuplicateProblems(
        server,
        liveServers.filter((one) => {
            return one !== now;
        }),
    );
    if (clashes.length > 0) {
        deps.print(
            `Not changed — the registry changed meanwhile: ${clashes.join('; ')}.`,
        );
        return 1;
    }
    await deps.publish(
        replaceServer(live, id, server, deps.today()),
        deps.print,
    );
    deps.print(
        `Changed: ${server.id === id ? id : `${id}, now ${server.id}`}. The app shows it after its next reload.`,
    );
    return 0;
}

/** Runs one command; answers the exit code. */
export async function runRegistryCommand(argv, overrides = {}) {
    const deps = { ...realDeps, ...overrides };
    const options = readRegistryArgs(argv);
    if (options === null) {
        deps.print(REGISTRY_USAGE);
        return 1;
    }
    if (options.command === 'add') {
        return addNew(deps);
    }
    if (options.command === 'modify') {
        return modifyOne(options.id, options.filePath, deps);
    }
    if (options.command === 'remove') {
        const isAgreed =
            options.isYes ||
            (deps.isInteractive() &&
                (await deps.ask(
                    `Take "${options.id}" out of the shared registry?`,
                )));
        if (!isAgreed) {
            deps.print(
                deps.isInteractive()
                    ? 'Left as it is.'
                    : 'Not asked here (no terminal): pass --yes to take it out.',
            );
            return 0;
        }
        await takeOut([options.id], deps);
        return 0;
    }
    const registry = await readPublicRegistry(deps.fetchUrl);
    const servers = listServers(registry);
    deps.print(
        `${servers.length} shared server${servers.length === 1 ? '' : 's'}` +
            (registry.updated ? `, updated ${registry.updated}` : '') +
            ` — ${PUBLIC_URL}`,
    );
    if (options.command === 'list') {
        for (const server of servers) {
            deps.print('');
            for (const line of describeServer(server)) {
                deps.print(line);
            }
        }
        return 0;
    }
    // check
    const unreachable = [];
    for (const server of servers) {
        const result = await checkSharedServer(server, deps.fetchUrl);
        deps.print(
            `  ${result.isReachable ? 'reachable  ' : 'UNREACHABLE'}  ${server.id}  ${server.name ?? ''} — ${result.detail}`,
        );
        if (!result.isReachable) {
            unreachable.push(server);
        }
    }
    if (unreachable.length === 0) {
        deps.print(servers.length === 0 ? '' : 'Every shared server answers.');
        return 0;
    }
    const toRemove = [];
    if (options.isRemovingUnreachable) {
        toRemove.push(...unreachable);
    } else if (deps.isInteractive()) {
        for (const server of unreachable) {
            if (
                await deps.ask(
                    `Take "${server.name ?? server.id}" (${server.id}) out of the shared registry?`,
                )
            ) {
                toRemove.push(server);
            }
        }
    } else {
        deps.print(
            'Not asked here (no terminal): run it in a terminal to choose, or pass --remove-unreachable.',
        );
    }
    if (toRemove.length === 0) {
        deps.print('Nothing taken out.');
        return 0;
    }
    await takeOut(
        toRemove.map((server) => {
            return server.id;
        }),
        deps,
    );
    return 0;
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
    runRegistryCommand(process.argv.slice(2)).then(
        (code) => {
            process.exitCode = code;
        },
        (error) => {
            console.error(error?.message ?? error);
            process.exitCode = 1;
        },
    );
}
