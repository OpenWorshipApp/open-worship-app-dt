import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
    NEW_SERVER_TEMPLATE,
    addServer,
    checkIsLocalAddress,
    checkSharedServer,
    describeServer,
    readNewServer,
    readRegistryArgs,
    removeServers,
    replaceServer,
    runRegistryCommand,
    toEditableText,
} from './llm-registry.mjs';
import {
    PUBLIC_URL,
    findRegistryProblems,
    toPublishedRegistry,
} from './s3-push-llm-registry.mjs';

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
// Not an assistant: the address the app posts its problem reports to.
const REPORTS = {
    id: 'reporting',
    name: 'Report inbox',
    baseUrl: 'https://reports-1234.trycloudflare.com/report',
    apiKey: 'sk-report',
    isAcceptingReport: true,
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

// The kit keeps its own copy of the registry's schema, so the folder can be
// copied out whole: the two must say the same thing.
describe('llm-info.schema.json', () => {
    const readJson = (relativePath) => {
        return JSON.parse(
            fs.readFileSync(new URL(relativePath, import.meta.url), 'utf-8'),
        );
    };

    it('is the shape docs/llm-registry/info.schema.json documents', () => {
        const kit = readJson('./llm-info.schema.json');
        const docs = readJson('../../docs/llm-registry/info.schema.json');
        expect(kit.$defs).toEqual(docs.$defs);
        expect(kit.properties).toEqual(docs.properties);
        expect(kit.required).toEqual(docs.required);
        expect(kit.type).toBe(docs.type);
    });

    it('knows an entry that takes reports, which needs no models', () => {
        const { server } = readJson('./llm-info.schema.json').$defs;
        expect(server.properties.isAcceptingReport.type).toBe('boolean');
        expect(server.required).toEqual(['id', 'name', 'baseUrl']);
        expect(server.if.properties.isAcceptingReport.const).toBe(true);
        expect(server.else.required).toEqual(['models']);
    });

    it('is a line for the editor, left out of what is published', () => {
        const kept = {
            $schema: './llm-info.schema.json',
            version: 1,
            updated: '2026-10-13',
            servers: [REPORTS],
        };
        expect(findRegistryProblems(kept)).toEqual([]);
        expect(toPublishedRegistry(kept)).toEqual({
            version: 1,
            updated: '2026-10-13',
            servers: [REPORTS],
        });
        // The file the editor has open is not what was changed.
        expect(kept.$schema).toBe('./llm-info.schema.json');
    });

    // Not `llm-info.json` itself: that one is edited by hand, and a test
    // must not fail on somebody's half-typed entry.
    it('describes the example in the docs, its report entry included', () => {
        const example = readJson('../../docs/llm-registry/info.example.json');
        expect(findRegistryProblems(example)).toEqual([]);
        expect(
            example.servers.filter((server) => {
                return server.isAcceptingReport === true;
            }),
        ).toHaveLength(1);
    });
});

describe('readRegistryArgs', () => {
    it('reads the five commands', () => {
        expect(readRegistryArgs(['list'])).toMatchObject({ command: 'list' });
        expect(readRegistryArgs(['add'])).toMatchObject({ command: 'add' });
        expect(readRegistryArgs(['check', '--remove-unreachable'])).toEqual({
            command: 'check',
            id: '',
            filePath: '',
            isRemovingUnreachable: true,
            isYes: false,
        });
        expect(readRegistryArgs(['remove', 'old-tunnel', '--yes'])).toEqual({
            command: 'remove',
            id: 'old-tunnel',
            filePath: '',
            isRemovingUnreachable: false,
            isYes: true,
        });
        expect(readRegistryArgs(['modify', 'old-tunnel'])).toMatchObject({
            command: 'modify',
            id: 'old-tunnel',
            filePath: '',
        });
        expect(
            readRegistryArgs(['modify', 'old-tunnel', './entry.json']),
        ).toMatchObject({
            command: 'modify',
            id: 'old-tunnel',
            filePath: './entry.json',
        });
    });

    it('refuses what it cannot read', () => {
        expect(readRegistryArgs([])).toBeNull();
        expect(readRegistryArgs(['delete'])).toBeNull();
        expect(readRegistryArgs(['remove'])).toBeNull();
        expect(readRegistryArgs(['remove', 'not a slug'])).toBeNull();
        expect(readRegistryArgs(['list', '--yes'])).toBeNull();
        expect(readRegistryArgs(['remove', 'a', 'b'])).toBeNull();
        // The entry is typed in the editor, not on the command line.
        expect(readRegistryArgs(['add', 'new-box'])).toBeNull();
        expect(readRegistryArgs(['add', '--yes'])).toBeNull();
        // The id first, then at most one file.
        expect(readRegistryArgs(['modify'])).toBeNull();
        expect(readRegistryArgs(['modify', './entry.json'])).toBeNull();
        expect(readRegistryArgs(['modify', 'a', 'b.json', 'c.json'])).toBeNull();
        expect(readRegistryArgs(['modify', 'a', '--yes'])).toBeNull();
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

    it('says an entry that takes reports is one, where the models would be', () => {
        const text = describeServer(REPORTS).join('\n');
        expect(text).toContain('reporting   Report inbox');
        expect(text).toContain('takes reports (not offered as an assistant)');
        expect(text).not.toContain('models:');
        expect(text).not.toContain('sk-report');
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

    // One tunnel doing both is an assistant first: asked the usual way.
    it('asks an entry that is an assistant too for its model list', async () => {
        const both = { ...TUNNEL, isAcceptingReport: true };
        const { fetchUrl, asked } = genFetch(genRegistry([]), {
            [`${TUNNEL.baseUrl}/models`]: 200,
        });
        expect(await checkSharedServer(both, fetchUrl)).toEqual({
            isReachable: true,
            detail: 'answers',
        });
        expect(asked[0].url).toBe(`${TUNNEL.baseUrl}/models`);
        const text = describeServer(both).join('\n');
        expect(text).toContain(
            'models: qwen/qwen3.5-9b, google/gemma-4-e4b   also takes reports',
        );
    });

    // It has no model list, and a check must not file a report to try it.
    it('asks an address that takes reports where it is, and never posts to it', async () => {
        const { fetchUrl, asked } = genFetch(genRegistry([]), {
            [REPORTS.baseUrl]: 405,
        });
        expect(await checkSharedServer(REPORTS, fetchUrl)).toEqual({
            isReachable: true,
            detail: 'takes reports; answers (405 to a GET — no report was sent to try it)',
        });
        expect(asked).toEqual([
            { url: REPORTS.baseUrl, authorization: 'Bearer sk-report' },
        ]);
        expect(
            await checkSharedServer(
                REPORTS,
                genFetch(genRegistry([]), { [REPORTS.baseUrl]: 401 }).fetchUrl,
            ),
        ).toEqual({
            isReachable: true,
            detail: 'takes reports; answers, but refuses the key in the registry (401)',
        });
        // A tunnel with nothing behind it, and a name that is gone.
        expect(
            await checkSharedServer(
                REPORTS,
                genFetch(genRegistry([]), { [REPORTS.baseUrl]: 530 }).fetchUrl,
            ),
        ).toEqual({ isReachable: false, detail: 'answered 530' });
        expect(
            await checkSharedServer(
                REPORTS,
                genFetch(genRegistry([]), {}).fetchUrl,
            ),
        ).toEqual({
            isReachable: false,
            detail: 'could not be reached (ENOTFOUND)',
        });
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

// The template as somebody leaves it after filling it in, in the editor.
function fillTemplate(changes, modelChanges = {}) {
    const entry = JSON.parse(NEW_SERVER_TEMPLATE);
    return JSON.stringify(
        {
            ...entry,
            ...changes,
            models: [{ ...entry.models[0], ...modelChanges }],
        },
        null,
        4,
    );
}

const NEW = {
    id: 'new-box',
    name: 'New box',
    baseUrl: 'https://new-box.example.com/v1',
    apiKey: 'sk-new',
    isFree: true,
    note: 'Slow, but it saves us the cost of usage.',
};
const NEW_MODEL = { model: 'q/new-model', canSeeImages: true };
const NEW_SERVER = { ...NEW, models: [NEW_MODEL] };

describe('readNewServer', () => {
    it('leaves out a placeholder or a false, and keeps what was filled in', () => {
        expect(
            readNewServer(
                fillTemplate(
                    { ...NEW, name: '  New box ' },
                    { ...NEW_MODEL, model: ' q/new-model' },
                ),
                [TUNNEL],
            ),
        ).toEqual({ server: NEW_SERVER, problems: [] });
    });

    it('says each field not filled in, once', () => {
        expect(readNewServer(NEW_SERVER_TEMPLATE, []).problems).toEqual([
            '"id" is not filled in',
            '"name" is not filled in',
            '"baseUrl" is not filled in',
            'models must name at least one model',
        ]);
    });

    it('takes an entry that only takes reports with the model row left as it is', () => {
        const { server, problems } = readNewServer(
            fillTemplate({
                id: 'reports',
                name: 'Report inbox',
                baseUrl: 'https://reports.example.com/report',
                isAcceptingReport: true,
            }),
            [TUNNEL],
        );
        expect(problems).toEqual([]);
        expect(server).toEqual({
            id: 'reports',
            name: 'Report inbox',
            baseUrl: 'https://reports.example.com/report',
            isAcceptingReport: true,
        });
    });

    it('refuses an id or a name another entry has, whatever its case', () => {
        expect(
            readNewServer(
                fillTemplate(
                    { ...NEW, id: 'Church-LMStudio', name: 'church lm studio' },
                    NEW_MODEL,
                ),
                [GONE, TUNNEL],
            ).problems,
        ).toEqual([
            'id "Church-LMStudio" is already in the registry ("Church LM Studio"): choose another',
            'name "church lm studio" is already used by "church-lmstudio": choose another',
        ]);
    });

    it('says what the app would refuse or cut', () => {
        const { problems } = readNewServer(
            fillTemplate(
                {
                    ...NEW,
                    baseUrl: 'ftp://new-box.example.com',
                    isFree: 'yes',
                    name: 'x'.repeat(61),
                },
                { model: '', name: 'Named, with no model id' },
            ),
            [],
        );
        expect(problems).toEqual([
            '"isFree" must be true or false',
            '"models[0].model" is not filled in',
            '"name" is over 60 characters: the app cuts it',
            'baseUrl must be an http(s) address',
            'models must name at least one model',
        ]);
    });

    it('says when the file is not one JSON object', () => {
        expect(readNewServer('{ "id": ', []).problems[0]).toMatch(
            /^not JSON: /,
        );
        expect(readNewServer('[]', []).problems).toEqual([
            'the entry must be one JSON object, { ... }',
        ]);
    });
});

describe('addServer', () => {
    it('puts the server at the end and leaves every other one as it is', () => {
        expect(
            addServer(genRegistry([TUNNEL, GONE]), NEW_SERVER, '2026-10-11'),
        ).toEqual({
            version: 1,
            updated: '2026-10-11',
            servers: [TUNNEL, GONE, NEW_SERVER],
        });
    });
});

describe('add', () => {
    const answers = { [`${NEW.baseUrl}/models`]: 200 };
    const genFilledEdit = (changes = NEW) => {
        return async () => {
            return fillTemplate(changes, NEW_MODEL);
        };
    };
    const askYes = async () => {
        return true;
    };

    it('opens the placeholders, then checks, shows and adds it after a yes', async () => {
        const edit = vi.fn(genFilledEdit());
        const ask = vi.fn(askYes);
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL]),
            answers,
            { edit, ask },
        );
        expect(await runRegistryCommand(['add'], deps)).toBe(0);
        expect(edit.mock.calls).toEqual([[NEW_SERVER_TEMPLATE]]);
        expect(ask.mock.calls.map((call) => call[0])).toEqual([
            'Add "New box" (new-box) to the shared registry?',
        ]);
        expect(published).toEqual([
            {
                version: 1,
                updated: '2026-10-11',
                servers: [TUNNEL, NEW_SERVER],
            },
        ]);
        const text = lines.join('\n');
        expect(text).toContain(
            '"note": "Slow, but it saves us the cost of usage."',
        );
        expect(text).toContain('"apiKey": "(set — not shown)"');
        expect(text).not.toContain('sk-new');
        expect(text).toContain('reachable — answers');
        expect(lines.at(-1)).toBe(
            'Added: new-box. The app shows it after its next reload.',
        );
    });

    it('adds nothing on a no', async () => {
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL]),
            answers,
            { edit: genFilledEdit() },
        );
        expect(await runRegistryCommand(['add'], deps)).toBe(0);
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe('Nothing added.');
    });

    it('adds nothing when the editor is left as it was, emptied or quit with a failure', async () => {
        for (const [edited, said] of [
            [NEW_SERVER_TEMPLATE, 'Nothing added.'],
            ['  \n', 'Nothing added.'],
            [null, 'Nothing added: the editor ended with a failure.'],
        ]) {
            const { deps, lines, published, questions } = genDeps(
                genRegistry([TUNNEL]),
                answers,
                {
                    edit: async () => {
                        return edited;
                    },
                },
            );
            expect(await runRegistryCommand(['add'], deps)).toBe(0);
            expect(questions).toEqual([]);
            expect(published).toEqual([]);
            expect(lines.at(-1)).toBe(said);
        }
    });

    it('opens it again as it was left when it cannot be added', async () => {
        const taken = fillTemplate(
            { ...NEW, name: 'Church LM Studio' },
            NEW_MODEL,
        );
        const edit = vi
            .fn()
            .mockResolvedValueOnce(taken)
            .mockResolvedValueOnce(fillTemplate(NEW, NEW_MODEL));
        const ask = vi.fn(askYes);
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL]),
            answers,
            { edit, ask },
        );
        expect(await runRegistryCommand(['add'], deps)).toBe(0);
        expect(lines).toContain(
            '  - name "Church LM Studio" is already used by "church-lmstudio": choose another',
        );
        expect(edit.mock.calls).toEqual([[NEW_SERVER_TEMPLATE], [taken]]);
        expect(ask.mock.calls.map((call) => call[0])).toEqual([
            'Edit it again?',
            'Add "New box" (new-box) to the shared registry?',
        ]);
        expect(published[0].servers).toEqual([TUNNEL, NEW_SERVER]);
    });

    it('adds nothing when it is not to be edited again', async () => {
        const { deps, lines, published, questions } = genDeps(
            genRegistry([TUNNEL]),
            answers,
            { edit: genFilledEdit({ ...NEW, id: 'church-lmstudio' }) },
        );
        expect(await runRegistryCommand(['add'], deps)).toBe(0);
        expect(questions).toEqual(['Edit it again?']);
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe('Nothing added.');
    });

    // A tunnel may write the registry while the editor is open.
    it('adds nothing the registry took meanwhile', async () => {
        const readPublished = vi
            .fn()
            .mockResolvedValueOnce(genRegistry([TUNNEL]))
            .mockResolvedValueOnce(
                genRegistry([TUNNEL, { ...GONE, id: 'new-box' }]),
            );
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL]),
            answers,
            { readPublished, edit: genFilledEdit(), ask: askYes },
        );
        expect(await runRegistryCommand(['add'], deps)).toBe(1);
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe(
            'Not added — the registry changed meanwhile: id "new-box" is already in the registry ("Old tunnel"): choose another.',
        );
    });

    it('opens no editor where there is no terminal, or when the registry is full', async () => {
        const edit = vi.fn();
        const noTerminal = genDeps(genRegistry([]), {}, {
            edit,
            isInteractive: () => {
                return false;
            },
        });
        expect(await runRegistryCommand(['add'], noTerminal.deps)).toBe(1);
        expect(noTerminal.lines.join('\n')).toContain('run add in a terminal');
        const full = genDeps(
            genRegistry(
                Array.from({ length: 20 }, (_, index) => {
                    return { ...GONE, id: `server-${index}` };
                }),
            ),
            {},
            { edit },
        );
        expect(await runRegistryCommand(['add'], full.deps)).toBe(1);
        expect(full.lines.join('\n')).toContain('take one out first');
        expect(edit).not.toHaveBeenCalled();
    });
});

describe('toEditableText', () => {
    it('opens an entry with a placeholder in each field it leaves out', () => {
        const opened = JSON.parse(toEditableText(TUNNEL));
        expect(opened).toMatchObject({
            ...TUNNEL,
            note: JSON.parse(NEW_SERVER_TEMPLATE).note,
            isAcceptingReport: false,
        });
        expect(opened.models[1]).toEqual({
            ...JSON.parse(NEW_SERVER_TEMPLATE).models[0],
            model: 'google/gemma-4-e4b',
        });
    });

    it('reads back as the entry it opened', () => {
        expect(readNewServer(toEditableText(TUNNEL), []).server).toEqual(
            TUNNEL,
        );
        expect(readNewServer(toEditableText(REPORTS), []).server).toEqual(
            REPORTS,
        );
    });
});

describe('replaceServer', () => {
    it('puts the server where the one with the id stood', () => {
        expect(
            replaceServer(
                genRegistry([TUNNEL, GONE, LAN]),
                'old-tunnel',
                NEW_SERVER,
                '2026-10-11',
            ),
        ).toEqual({
            version: 1,
            updated: '2026-10-11',
            servers: [TUNNEL, NEW_SERVER, LAN],
        });
    });
});

describe('modify', () => {
    // GONE as it reads back: its empty key is no key.
    const GONE_READ = {
        id: 'old-tunnel',
        name: 'Old tunnel',
        baseUrl: 'https://gone-away-0000.trycloudflare.com/v1',
        models: [{ model: 'x/model' }],
    };
    const genChange = (changes) => {
        return (text) => {
            return JSON.stringify(
                { ...JSON.parse(text), ...changes },
                null,
                4,
            );
        };
    };
    const askYes = async () => {
        return true;
    };

    it('opens the entry as it is in the editor, and changes it where it stands after a yes', async () => {
        const edit = vi.fn(
            genChange({ name: 'Old tunnel, back', note: 'Back on Sunday.' }),
        );
        const ask = vi.fn(askYes);
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL, GONE, LAN]),
            {},
            { edit, ask },
        );
        expect(await runRegistryCommand(['modify', 'old-tunnel'], deps)).toBe(
            0,
        );
        expect(edit.mock.calls).toEqual([[toEditableText(GONE)]]);
        expect(lines).toContain('The entry, changed (name, note):');
        expect(ask.mock.calls.map((call) => call[0])).toEqual([
            'Change "Old tunnel" (old-tunnel) in the shared registry?',
        ]);
        expect(published).toEqual([
            {
                version: 1,
                updated: '2026-10-11',
                servers: [
                    TUNNEL,
                    {
                        ...GONE_READ,
                        name: 'Old tunnel, back',
                        note: 'Back on Sunday.',
                    },
                    LAN,
                ],
            },
        ]);
        expect(lines.at(-1)).toBe(
            'Changed: old-tunnel. The app shows it after its next reload.',
        );
    });

    it('never prints the key of the entry it changes', async () => {
        const { deps, lines } = genDeps(genRegistry([TUNNEL]), {}, {
            edit: genChange({ note: 'Slow on Sundays.' }),
            ask: askYes,
        });
        await runRegistryCommand(['modify', 'church-lmstudio'], deps);
        expect(lines.join('\n')).not.toContain('sk-the-key');
        expect(lines.join('\n')).toContain('"apiKey": "(set — not shown)"');
    });

    it('changes nothing when the entry is left as it is', async () => {
        for (const [edit, said] of [
            [(text) => text, 'Nothing changed.'],
            // Saved again in another shape, but the same entry.
            [
                (text) => JSON.stringify(JSON.parse(text)),
                'Nothing changed: the entry is as the registry holds it.',
            ],
        ]) {
            const { deps, lines, published, questions } = genDeps(
                genRegistry([TUNNEL, GONE]),
                {},
                { edit, ask: askYes },
            );
            expect(
                await runRegistryCommand(['modify', 'old-tunnel'], deps),
            ).toBe(0);
            expect(questions).toEqual([]);
            expect(published).toEqual([]);
            expect(lines.at(-1)).toBe(said);
        }
    });

    it("keeps its own id and name, and refuses another entry's", async () => {
        const edit = vi.fn(genChange({ name: 'church LM studio' }));
        const { deps, lines, published, questions } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
            { edit },
        );
        expect(await runRegistryCommand(['modify', 'old-tunnel'], deps)).toBe(
            0,
        );
        expect(lines).toContain(
            '  - name "church LM studio" is already used by "church-lmstudio": choose another',
        );
        expect(questions).toEqual(['Edit it again?']);
        expect(published).toEqual([]);
    });

    it('reads the entry as it is to be from a file, without the editor', async () => {
        const edit = vi.fn();
        const readFile = vi.fn(async () => {
            return JSON.stringify({
                ...GONE_READ,
                id: 'new-tunnel',
                baseUrl: 'https://back-again-1111.trycloudflare.com/v1',
            });
        });
        const ask = vi.fn(askYes);
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL, GONE, LAN]),
            {},
            { edit, readFile, ask },
        );
        expect(
            await runRegistryCommand(
                ['modify', 'old-tunnel', './entry.json'],
                deps,
            ),
        ).toBe(0);
        expect(edit).not.toHaveBeenCalled();
        expect(readFile.mock.calls).toEqual([['./entry.json']]);
        expect(lines).toContain('The entry, changed (id, baseUrl):');
        expect(lines.join('\n')).toContain('The id changes from "old-tunnel"');
        expect(ask.mock.calls.map((call) => call[0])).toEqual([
            'Change "Old tunnel" (old-tunnel) in the shared registry?',
        ]);
        expect(published[0].servers).toEqual([
            TUNNEL,
            {
                ...GONE_READ,
                id: 'new-tunnel',
                baseUrl: 'https://back-again-1111.trycloudflare.com/v1',
            },
            LAN,
        ]);
        expect(lines.at(-1)).toBe(
            'Changed: old-tunnel, now new-tunnel. The app shows it after its next reload.',
        );
    });

    it('says what is wrong with a file and asks nothing', async () => {
        const { deps, lines, published, questions } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
            {
                readFile: async () => {
                    return JSON.stringify({ ...GONE_READ, baseUrl: 'gone' });
                },
            },
        );
        expect(
            await runRegistryCommand(
                ['modify', 'old-tunnel', './entry.json'],
                deps,
            ),
        ).toBe(1);
        expect(lines).toContain('  - baseUrl must be an http(s) address');
        expect(lines.at(-1)).toBe(
            'Nothing changed: fix ./entry.json and run it again.',
        );
        expect(questions).toEqual([]);
        expect(published).toEqual([]);
    });

    it('says which file it cannot read', async () => {
        const { deps, lines } = genDeps(genRegistry([GONE]), {}, {
            readFile: async () => {
                throw Object.assign(new Error('no such file'), {
                    code: 'ENOENT',
                });
            },
        });
        expect(
            await runRegistryCommand(['modify', 'old-tunnel', './nope.json'], deps),
        ).toBe(1);
        expect(lines).toEqual([
            'Nothing changed: ./nope.json cannot be read (ENOENT).',
        ]);
    });

    it('says so for an id the registry does not have', async () => {
        const edit = vi.fn();
        const { deps, lines } = genDeps(genRegistry([TUNNEL]), {}, { edit });
        expect(await runRegistryCommand(['modify', 'not-there'], deps)).toBe(
            1,
        );
        expect(lines).toEqual([
            '"not-there" is not in the registry: list shows the ids.',
        ]);
        expect(edit).not.toHaveBeenCalled();
    });

    // A tunnel rewrites its own entry when its address changes.
    it('writes nothing over an entry changed while it was open', async () => {
        const readPublished = vi
            .fn()
            .mockResolvedValueOnce(genRegistry([TUNNEL, GONE]))
            .mockResolvedValueOnce(
                genRegistry([
                    TUNNEL,
                    { ...GONE, baseUrl: 'https://new-1234.trycloudflare.com/v1' },
                ]),
            );
        const { deps, lines, published } = genDeps(
            genRegistry([TUNNEL, GONE]),
            {},
            { readPublished, edit: genChange({ note: 'x' }), ask: askYes },
        );
        expect(await runRegistryCommand(['modify', 'old-tunnel'], deps)).toBe(
            1,
        );
        expect(published).toEqual([]);
        expect(lines.at(-1)).toBe(
            'Not changed — "old-tunnel" was changed meanwhile: run modify again.',
        );
    });

    it('asks nothing where there is no terminal', async () => {
        const edit = vi.fn();
        const { deps, lines } = genDeps(genRegistry([GONE]), {}, {
            edit,
            isInteractive: () => {
                return false;
            },
        });
        expect(
            await runRegistryCommand(
                ['modify', 'old-tunnel', './entry.json'],
                deps,
            ),
        ).toBe(1);
        expect(lines).toEqual([
            'Not asked here (no terminal): run modify in a terminal.',
        ]);
        expect(edit).not.toHaveBeenCalled();
    });
});
