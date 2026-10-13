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
//
// `list` and `check` need nothing but the internet. Taking a server out
// writes the registry, which needs this repo's `node_modules` and
// `extra-work/.env`, like `s3-push-llm-registry.mjs`. A key is never printed.

import fs from 'node:fs';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import {
    PUBLIC_URL,
    publishRegistry,
    readPublishedRegistry,
} from './s3-push-llm-registry.mjs';

const CHECK_TIMEOUT_MILLISECOND = 10000;
const ID_PATTERN = /^[A-Za-z0-9-]{1,48}$/;

export const REGISTRY_USAGE = [
    'Usage: node llm-registry.mjs list',
    '       node llm-registry.mjs check [--remove-unreachable]',
    '       node llm-registry.mjs remove <id> [--yes]',
    '',
    '  list    the servers shared right now',
    '  check   asks each one whether it answers, and for one that does not',
    '          asks whether to take it out; --remove-unreachable takes them',
    '          all out without asking',
    '  remove  takes one server out, by its id; --yes does not ask first',
].join('\n');

/** The command and its options, or null when they cannot be read. */
export function readRegistryArgs(argv) {
    const options = {
        command: argv[0] ?? '',
        id: '',
        isRemovingUnreachable: false,
        isYes: false,
    };
    let isBad = !['list', 'check', 'remove'].includes(options.command);
    for (const arg of argv.slice(1)) {
        if (arg === '--remove-unreachable' && options.command === 'check') {
            options.isRemovingUnreachable = true;
        } else if (arg === '--yes' && options.command === 'remove') {
            options.isYes = true;
        } else if (
            options.command === 'remove' &&
            options.id === '' &&
            ID_PATTERN.test(arg)
        ) {
            options.id = arg;
        } else {
            isBad = true;
        }
    }
    if (isBad || (options.command === 'remove' && options.id === '')) {
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

const realDeps = {
    fetchUrl: (url, init) => {
        return fetch(url, init);
    },
    readPublished: readPublishedRegistry,
    publish: publishRegistry,
    ask: askYesNo,
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

/** Runs one command; answers the exit code. */
export async function runRegistryCommand(argv, overrides = {}) {
    const deps = { ...realDeps, ...overrides };
    const options = readRegistryArgs(argv);
    if (options === null) {
        deps.print(REGISTRY_USAGE);
        return 1;
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
