import { describe, expect, it, vi } from 'vitest';

import {
    checkIsLocalAddress,
    checkSharedServer,
    describeServer,
    readRegistryArgs,
    removeServers,
    runRegistryCommand,
} from './llm-registry.mjs';
import { PUBLIC_URL } from './s3-push-llm-registry.mjs';

const TUNNEL = {
    id: 'church-lmstudio',
    name: 'Church LM Studio',
    baseUrl: 'https://quiet-river-1234.trycloudflare.com/v1',
    apiKey: 'sk-the-key',
    isFree: true,
    models: [{ model: 'qwen/qwen3.5-9b' }, { model: 'google/gemma-4-e4b' }],
};
const GONE = {
    id: 'old-tunnel',
    name: 'Old tunnel',
    baseUrl: 'https://gone-away-0000.trycloudflare.com/v1',
    apiKey: '',
    models: [{ model: 'x/model' }],
};
const LAN = {
    id: 'lan-box',
    name: 'LAN box',
    baseUrl: 'http://192.168.1.50:1234/v1',
    apiKey: '',
    models: [{ model: 'y/model' }],
};

function genRegistry(servers) {
    return { version: 1, updated: '2026-10-10', servers };
}

// The public file, and each server's own answer, by address.
function genFetch(registry, answers) {
    const asked = [];
    const fetchUrl = async (url, init) => {
        asked.push({ url, authorization: init?.headers?.authorization });
        if (url === PUBLIC_URL) {
            return {
                ok: true,
                status: 200,
                text: async () => {
                    return typeof registry === 'string'
                        ? registry
                        : JSON.stringify(registry);
                },
            };
        }
        const answer = answers[url];
        if (answer === undefined) {
            throw Object.assign(new Error('fetch failed'), {
                cause: { code: 'ENOTFOUND' },
            });
        }
        if (answer === 'timeout') {
            throw Object.assign(new Error('timed out'), {
                name: 'TimeoutError',
            });
        }
        return {
            ok: answer >= 200 && answer < 300,
            status: answer,
            body: null,
        };
    };
    return { fetchUrl, asked };
}

function genDeps(registry, answers, overrides = {}) {
    const { fetchUrl, asked } = genFetch(registry, answers);
    const lines = [];
    const published = [];
    const questions = [];
    return {
        asked,
        lines,
        published,
        questions,
        deps: {
            fetchUrl,
            readPublished: async () => {
                return registry;
            },
            publish: async (data) => {
                published.push(data);
            },
            ask: async (question) => {
                questions.push(question);
                return false;
            },
            print: (text = '') => {
                lines.push(text);
            },
            isInteractive: () => {
                return true;
            },
            today: () => {
                return '2026-10-11';
            },
            ...overrides,
        },
    };
}

describe('readRegistryArgs', () => {
    it('reads the three commands', () => {
        expect(readRegistryArgs(['list'])).toMatchObject({ command: 'list' });
        expect(readRegistryArgs(['check', '--remove-unreachable'])).toEqual({
            command: 'check',
            id: '',
            isRemovingUnreachable: true,
            isYes: false,
        });
        expect(readRegistryArgs(['remove', 'old-tunnel', '--yes'])).toEqual({
            command: 'remove',
            id: 'old-tunnel',
            isRemovingUnreachable: false,
            isYes: true,
        });
    });

    it('refuses what it cannot read', () => {
        expect(readRegistryArgs([])).toBeNull();
        expect(readRegistryArgs(['delete'])).toBeNull();
        expect(readRegistryArgs(['remove'])).toBeNull();
        expect(readRegistryArgs(['remove', 'not a slug'])).toBeNull();
        expect(readRegistryArgs(['list', '--yes'])).toBeNull();
        expect(readRegistryArgs(['remove', 'a', 'b'])).toBeNull();
    });
});

describe('what is said of a server', () => {
    it('says that it has a key and never which', () => {
        const text = describeServer(TUNNEL).join('\n');
        expect(text).toContain('church-lmstudio   Church LM Studio');
        expect(text).toContain(
            'https://quiet-river-1234.trycloudflare.com/v1   key: yes   free',
        );
        expect(text).toContain('models: qwen/qwen3.5-9b, google/gemma-4-e4b');
        expect(text).not.toContain('sk-the-key');
        expect(describeServer(GONE).join('\n')).toContain('key: none');
    });

    it("knows an address of somebody's own network", () => {
        expect(checkIsLocalAddress('http://192.168.1.50:1234/v1')).toBe(true);
        expect(checkIsLocalAddress('http://10.0.0.7/v1')).toBe(true);
        expect(checkIsLocalAddress('http://172.20.1.1/v1')).toBe(true);
        expect(checkIsLocalAddress('http://gpu-box:1234/v1')).toBe(true);
        expect(checkIsLocalAddress('http://gpu-box.local/v1')).toBe(true);
        expect(checkIsLocalAddress('http://localhost:11434/v1')).toBe(true);
        expect(checkIsLocalAddress('http://172.32.0.1/v1')).toBe(false);
        expect(
            checkIsLocalAddress(
                'https://quiet-river-1234.trycloudflare.com/v1',
            ),
        ).toBe(false);
        expect(checkIsLocalAddress('not an address')).toBe(false);
    });
});

describe('checkSharedServer', () => {
    it('asks the model list with the key the registry carries', async () => {
        const { fetchUrl, asked } = genFetch(genRegistry([]), {
            [`${TUNNEL.baseUrl}/models`]: 200,
        });
        expect(await checkSharedServer(TUNNEL, fetchUrl)).toEqual({
            isReachable: true,
            detail: 'answers',
        });
        expect(asked).toEqual([
            {
                url: `${TUNNEL.baseUrl}/models`,
                authorization: 'Bearer sk-the-key',
            },
        ]);
    });

    it('counts a server that refuses the key as there, and says so', async () => {
        const { fetchUrl } = genFetch(genRegistry([]), {
            [`${TUNNEL.baseUrl}/models`]: 401,
        });
        expect(await checkSharedServer(TUNNEL, fetchUrl)).toEqual({
            isReachable: true,
            detail: 'answers, but refuses the key in the registry (401)',
        });
    });

    it("reads a dead tunnel's error page, no name and no answer as unreachable", async () => {
        const { fetchUrl } = genFetch(genRegistry([]), {
            [`${GONE.baseUrl}/models`]: 530,
            [`${LAN.baseUrl}/models`]: 'timeout',
        });
        expect(await checkSharedServer(GONE, fetchUrl)).toEqual({
            isReachable: false,
            detail: 'answered 530',
        });
        expect(await checkSharedServer(TUNNEL, fetchUrl)).toEqual({
            isReachable: false,
            detail: 'could not be reached (ENOTFOUND)',
        });
        // Not the same as gone: it answers on its own network.
        expect((await checkSharedServer(LAN, fetchUrl)).detail).toBe(
            'no answer in 10 s — a local-network address, which answers only on its own network',
        );
    });
});

describe('removeServers', () => {
    it('takes out the ids named and leaves every other server as it is', () => {
        expect(
            removeServers(
                genRegistry([TUNNEL, GONE, LAN]),
                ['old-tunnel'],
                '2026-10-11',
            ),
        ).toEqual({
            version: 1,
            updated: '2026-10-11',
            servers: [TUNNEL, LAN],
        });
    });

    it('makes an empty registry of one that is not a registry', () => {
        expect(removeServers(null, ['x'], '2026-10-11')).toEqual({
            version: 1,
            updated: '2026-10-11',
            servers: [],
        });
    });
});

describe('list', () => {
    it('prints the servers of the public file, with no key', async () => {
        const { deps, lines, asked, published } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
        );
        expect(await runRegistryCommand(['list'], deps)).toBe(0);
        const text = lines.join('\n');
        expect(text).toContain(
            `2 shared servers, updated 2026-10-10 — ${PUBLIC_URL}`,
        );
        expect(text).toContain('church-lmstudio   Church LM Studio');
        expect(text).toContain('old-tunnel   Old tunnel');
        expect(text).not.toContain('sk-the-key');
        // Just the file: no server is asked, nothing is written.
        expect(asked.map((one) => one.url)).toEqual([PUBLIC_URL]);
        expect(published).toEqual([]);
    });

    it('says so when nothing is published', async () => {
        const { deps } = genDeps('<!DOCTYPE html><html></html>', {});
        await expect(runRegistryCommand(['list'], deps)).rejects.toThrow(
            'nothing is published',
        );
    });
});

describe('check', () => {
    const answers = { [`${TUNNEL.baseUrl}/models`]: 200 };

    it('says which servers answer, and asks about each that does not', async () => {
        const ask = vi.fn(async (question) => {
            return question.includes('old-tunnel');
        });
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL, GONE, LAN]),
            { ...answers, [`${LAN.baseUrl}/models`]: 'timeout' },
            { ask },
        );
        expect(await runRegistryCommand(['check'], deps)).toBe(0);
        const text = lines.join('\n');
        expect(text).toContain(
            'reachable    church-lmstudio  Church LM Studio — answers',
        );
        expect(text).toContain('UNREACHABLE  old-tunnel  Old tunnel');
        expect(text).toContain('UNREACHABLE  lan-box  LAN box');
        // Asked once for each that did not answer, never for one that did.
        expect(ask.mock.calls.map((call) => call[0])).toEqual([
            'Take "Old tunnel" (old-tunnel) out of the shared registry?',
            'Take "LAN box" (lan-box) out of the shared registry?',
        ]);
        // Yes to one, no to the other: only that one is gone.
        expect(published).toEqual([
            { version: 1, updated: '2026-10-11', servers: [TUNNEL, LAN] },
        ]);
        expect(text).toContain('Taken out: old-tunnel.');
    });

    it('writes nothing when every answer is no', async () => {
        const { deps, lines, published, questions } = genDeps(
            genRegistry([TUNNEL, GONE]),
            answers,
        );
        await runRegistryCommand(['check'], deps);
        expect(questions).toHaveLength(1);
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe('Nothing taken out.');
    });

    it('asks nothing and writes nothing when every server answers', async () => {
        const { deps, lines, published, questions } = genDeps(
            genRegistry([TUNNEL]),
            answers,
        );
        await runRegistryCommand(['check'], deps);
        expect(questions).toEqual([]);
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe('Every shared server answers.');
    });

    it('takes every unreachable one out without asking when told to', async () => {
        const { deps, published, questions } = genDeps(
            genRegistry([TUNNEL, GONE, LAN]),
            answers,
        );
        await runRegistryCommand(['check', '--remove-unreachable'], deps);
        expect(questions).toEqual([]);
        expect(published).toEqual([
            { version: 1, updated: '2026-10-11', servers: [TUNNEL] },
        ]);
    });

    it('does not ask where there is no terminal to answer in', async () => {
        const { deps, lines, published, questions } = genDeps(
            genRegistry([GONE]),
            {},
            {
                isInteractive: () => {
                    return false;
                },
            },
        );
        await runRegistryCommand(['check'], deps);
        expect(questions).toEqual([]);
        expect(published).toEqual([]);
        expect(lines.join('\n')).toContain('pass --remove-unreachable');
    });
});

describe('remove', () => {
    it('asks first, and leaves it when the answer is no', async () => {
        const { deps, published, questions, lines } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
        );
        await runRegistryCommand(['remove', 'old-tunnel'], deps);
        expect(questions).toEqual([
            'Take "old-tunnel" out of the shared registry?',
        ]);
        expect(published).toEqual([]);
        expect(lines).toEqual(['Left as it is.']);
    });

    it('takes it out of the registry the site holds now', async () => {
        const { deps, published, questions } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
        );
        await runRegistryCommand(['remove', 'old-tunnel', '--yes'], deps);
        expect(questions).toEqual([]);
        expect(published).toEqual([
            { version: 1, updated: '2026-10-11', servers: [TUNNEL] },
        ]);
    });

    it('writes nothing for an id the registry does not have', async () => {
        const { deps, published, lines } = genDeps(genRegistry([TUNNEL]), {});
        await runRegistryCommand(['remove', 'not-there', '--yes'], deps);
        expect(published).toEqual([]);
        expect(lines).toEqual([
            'Nothing to take out: the registry no longer has it.',
        ]);
    });

    it('shows the usage for a command it does not know', async () => {
        const { deps, lines } = genDeps(genRegistry([]), {});
        expect(await runRegistryCommand(['purge'], deps)).toBe(1);
        expect(lines[0]).toContain('Usage: node llm-registry.mjs list');
    });
});
