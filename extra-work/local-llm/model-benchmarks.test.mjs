import { describe, expect, it } from 'vitest';

import {
    FIT_LIST,
    findBenchmarkProblems,
    genBenchmarkSummary,
    readBenchmarks,
} from './model-benchmarks.mjs';

function genStore() {
    return {
        version: 1,
        updated: '2026-10-10',
        machines: [
            { id: 'small', what: 'a laptop', vramGb: 4, ramGb: 16 },
            { id: 'big', what: 'a desktop', vramGb: 8, ramGb: null },
        ],
        rules: [{ rule: 'Load with 32k.', source: 'a note' }],
        models: [
            {
                model: 'b/slow-model',
                fit: 'usable',
                fitNote: 'Answers, slowly.',
                runs: [
                    {
                        date: '2026-10-10',
                        program: 'LM Studio',
                        machine: 'big',
                        task: 'app question with tools',
                        outcome: 'answered',
                        source: 'a note',
                        seconds: 20,
                        generatedTokens: 100,
                        promptTokensPerSecond: 900,
                    },
                ],
            },
            {
                model: 'a/fast-model',
                fit: 'good',
                fitNote: 'Answers app questions.',
                runs: [
                    {
                        date: '2026-10-09',
                        program: 'Ollama',
                        machine: 'small',
                        task: '/btw',
                        outcome: 'answered',
                        source: 'a note',
                        tokensPerSecond: 30,
                    },
                    {
                        date: '2026-10-10',
                        program: 'Ollama',
                        machine: 'big',
                        task: '/btw',
                        outcome: 'answered',
                        source: 'a note',
                        tokensPerSecond: 45,
                        promptTokensPerSecond: 50,
                    },
                ],
            },
            {
                model: 'c/unmeasured-speed',
                fit: 'unrated',
                runs: [
                    {
                        date: '2026-10-10',
                        program: 'llama.cpp',
                        machine: null,
                        task: 'app question',
                        outcome: 'answered',
                        source: 'a note',
                    },
                ],
            },
        ],
    };
}

describe('the store in the repo', () => {
    const data = readBenchmarks();

    it('has the shape everything else relies on', () => {
        expect(findBenchmarkProblems(data)).toEqual([]);
    });

    it('says where every measurement is recorded', () => {
        const runs = data.models.flatMap((model) => {
            return model.runs;
        });
        expect(runs.length).toBeGreaterThan(0);
        expect(
            runs.filter((run) => {
                return run.source.trim().length < 8;
            }),
        ).toEqual([]);
    });

    it('can be printed, whole and for a small graphics card', () => {
        expect(genBenchmarkSummary(data)).toHaveLength(data.models.length);
        const small = genBenchmarkSummary(data, { vramGb: 8 });
        expect(small.length).toBeGreaterThan(0);
        expect(
            small.filter((row) => {
                return row.ranInVramGb === null || row.ranInVramGb > 8;
            }),
        ).toEqual([]);
    });
});

describe('findBenchmarkProblems', () => {
    it('takes a well-formed store', () => {
        expect(findBenchmarkProblems(genStore())).toEqual([]);
    });

    it('refuses what is not a store at all', () => {
        expect(findBenchmarkProblems(null)).toEqual([
            'the file is not a JSON object',
        ]);
        expect(findBenchmarkProblems({ version: 2 })).toContain(
            '"version" must be 1',
        );
        expect(
            findBenchmarkProblems({ version: 1, updated: '2026-10-10' }),
        ).toContain('"models" must be a list');
    });

    it('names each thing that is wrong, and where', () => {
        const store = genStore();
        store.updated = 'yesterday';
        store.machines[1].id = 'small';
        store.rules.push({ rule: 'Said with nothing behind it.' });
        store.models[0].fit = 'great';
        store.models[1].fitNote = '';
        store.models[1].runs[0].machine = 'gone';
        store.models[1].runs[1].tokensPerSecond = 'fast';
        store.models[2].runs[0].source = '';
        store.models[2].model = 'a/fast-model';
        store.models.push({ model: 'd/empty', fit: 'unrated', runs: [] });
        expect(findBenchmarkProblems(store)).toEqual([
            '"updated" must be a date, YYYY-MM-DD',
            'machines[1].id is missing or used twice',
            'rules[1].source is missing',
            `models[0].fit must be one of ${FIT_LIST.join(', ')}`,
            'models[0].runs[0].machine "big" is not in "machines"',
            'models[1].fitNote must say why it is "good"',
            'models[1].runs[0].machine "gone" is not in "machines"',
            'models[1].runs[1].machine "big" is not in "machines"',
            'models[1].runs[1].tokensPerSecond must be a number or null',
            'models[2].model is missing or used twice',
            'models[2].runs[0].source is missing',
            'models[3].runs must hold at least one measurement',
        ]);
    });
});

describe('the summary', () => {
    it('puts the best fit first, with the speeds that were measured and the smallest machine it ran on', () => {
        expect(genBenchmarkSummary(genStore())).toEqual([
            {
                model: 'a/fast-model',
                fit: 'good',
                fitNote: 'Answers app questions.',
                runs: 2,
                bestPromptTokensPerSecond: 50,
                bestTokensPerSecond: 45,
                ranInVramGb: 4,
            },
            {
                model: 'b/slow-model',
                fit: 'usable',
                fitNote: 'Answers, slowly.',
                runs: 1,
                bestPromptTokensPerSecond: 900,
                // 100 tokens in 20 s is NOT read as 5 tokens a second: those
                // seconds hold the reading of the prompt too.
                bestTokensPerSecond: null,
                ranInVramGb: 8,
            },
            {
                model: 'c/unmeasured-speed',
                fit: 'unrated',
                fitNote: '',
                runs: 1,
                bestPromptTokensPerSecond: null,
                bestTokensPerSecond: null,
                ranInVramGb: null,
            },
        ]);
    });

    it('keeps what is known to run in the video memory asked about', () => {
        expect(
            genBenchmarkSummary(genStore(), { vramGb: 4 }).map((row) => {
                return row.model;
            }),
        ).toEqual(['a/fast-model']);
        expect(
            genBenchmarkSummary(genStore(), { vramGb: 8 }).map((row) => {
                return row.model;
            }),
        ).toEqual(['a/fast-model', 'b/slow-model']);
    });
});
