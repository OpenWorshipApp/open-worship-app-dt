import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
    AUTO_MAX_ATTEMPTS,
    AUTO_SLOW_MILLISECONDS,
    FREE_MODEL_SIZE,
    askWithAutoAssistant,
    checkHasAutoSetback,
    checkIsCloudModel,
    clearAutoSetbacks,
    describeSkippedAssistants,
    genAutoAnswerNote,
    USE_ASSISTANT_TOOL_NAME,
    USE_AUTO_LABEL,
    genAssistantSwitchActions,
    genHandOnAnswerNote,
    markAutoSetback,
    orderHandOnPicks,
    rankAutoCandidates,
    readAssistantSwitch,
    readModelSize,
    toAutoBusyKey,
    toAutoCandidateKey,
    type AutoAttemptType,
    type AutoCandidateStateType,
    type AutoCandidateType,
} from './autoAssistantHelpers';

function genServerCandidate(
    serverId: string,
    modelName: string,
    extra: Partial<AutoCandidateType> = {},
): AutoCandidateType {
    return {
        provider: 'custom',
        model: `${serverId}/${modelName.replace(/[^a-z0-9]/gi, '-')}`,
        serverId,
        label: `${serverId} · ${modelName}`,
        modelName,
        canSeeImages: false,
        ...extra,
    };
}

function genFreeCandidate(
    model: string,
    extra: Partial<AutoCandidateType> = {},
): AutoCandidateType {
    return {
        provider: 'free',
        model,
        serverId: null,
        label: `Free · ${model}`,
        modelName: model,
        canSeeImages: false,
        ...extra,
    };
}

function genStateMap(
    rows: [AutoCandidateType, Partial<AutoCandidateStateType>][],
) {
    return new Map(
        rows.map(([candidate, state]) => {
            return [
                toAutoCandidateKey(candidate),
                {
                    isReachable: true,
                    kind: null,
                    isLoaded: null,
                    loadedContext: null,
                    ...state,
                },
            ];
        }),
    );
}

const FREE = genFreeCandidate('nvidia/nemotron-3.5-lightning:free');
const BIG = genServerCandidate('super-computer', 'google/gemma-4-12b');
const NINE = genServerCandidate('super-computer', 'qwen/qwen3.5-9b');
const SMALL = genServerCandidate('laptop', 'qwen3.5:4b');

function toLabels(candidates: AutoCandidateType[]) {
    return candidates.map((one) => {
        return one.label;
    });
}

beforeEach(() => {
    clearAutoSetbacks();
});

describe('readModelSize', () => {
    test('reads the size a model is named after, in billions', () => {
        expect(readModelSize('qwen/qwen3.5-9b')).toBe(9);
        expect(readModelSize('qwen3.5:4b')).toBe(4);
        expect(readModelSize('google/gemma-4-12b')).toBe(12);
        expect(readModelSize('Meta-Llama-3.3-70B-Instruct-Q4_K_M.gguf')).toBe(
            70,
        );
        expect(readModelSize('deepseek-r1:1.5b')).toBe(1.5);
    });

    test("reads Gemma's effective size and a size in millions", () => {
        expect(readModelSize('google/gemma-4-e4b')).toBe(4);
        expect(readModelSize('gemma3:270m')).toBeCloseTo(0.27);
    });

    test('is 0 for a name that says no size', () => {
        // A context length and a quantisation are not sizes, and neither is
        // a version number.
        expect(readModelSize('phi-3.1-mini-128k-instruct')).toBe(0);
        expect(readModelSize('model-8bit-q4_k_m')).toBe(0);
        expect(readModelSize('LLaMA_CPP')).toBe(0);
        expect(readModelSize('')).toBe(0);
    });

    test('takes the biggest figure when the name carries two', () => {
        expect(readModelSize('qwen3.5:4b Qwen 3.5 9B')).toBe(9);
    });
});

describe('checkIsCloudModel', () => {
    test("reads Ollama's cloud tags, in the id and in the shown name", () => {
        expect(checkIsCloudModel('gemma4:cloud')).toBe(true);
        expect(checkIsCloudModel('gemma4:31b-cloud')).toBe(true);
        expect(checkIsCloudModel('deepseek-v4.1-flash:cloud')).toBe(true);
        // What `genAutoCandidates` hands in: the id, then the shown name.
        expect(checkIsCloudModel('gemma4:31b-cloud Gemma 4 31B')).toBe(true);
        expect(checkIsCloudModel('gemma4-31b Gemma 4 31B cloud')).toBe(true);
    });

    test('is false for a model that runs on the server itself', () => {
        expect(checkIsCloudModel('gemma4:12b')).toBe(false);
        expect(checkIsCloudModel('qwen3.5:9b')).toBe(false);
        expect(checkIsCloudModel('icloud-model')).toBe(false);
        expect(checkIsCloudModel('cloudy-7b')).toBe(false);
        expect(checkIsCloudModel('')).toBe(false);
    });
});

describe('toAutoBusyKey', () => {
    test('is the whole server for a model of one, the service otherwise', () => {
        expect(toAutoBusyKey('custom', 'server-1/row-1')).toBe(
            'custom/server-1',
        );
        expect(toAutoBusyKey('custom', 'server-1/row-2')).toBe(
            'custom/server-1',
        );
        expect(toAutoBusyKey('free', 'some/model:free')).toBe('free');
    });
});

describe('rankAutoCandidates', () => {
    test('asks the bigger model first', () => {
        expect(
            toLabels(rankAutoCandidates([SMALL, NINE, BIG], new Map())),
        ).toEqual([BIG.label, NINE.label, SMALL.label]);
    });

    test('asks a server model of the free line or more before the free service, and a smaller one after it', () => {
        expect(
            toLabels(rankAutoCandidates([SMALL, FREE, NINE], new Map())),
        ).toEqual([NINE.label, FREE.label, SMALL.label]);
        const atTheLine = genServerCandidate(
            'desk',
            `model-${FREE_MODEL_SIZE}b`,
        );
        expect(rankAutoCandidates([FREE, atTheLine], new Map())[0]).toBe(
            atTheLine,
        );
    });

    test('asks a model whose name says no size after the free service', () => {
        const unnamed = genServerCandidate('llamafile', 'LLaMA_CPP');
        expect(
            toLabels(rankAutoCandidates([unnamed, FREE], new Map())),
        ).toEqual([FREE.label, unnamed.label]);
    });

    // The user's own Ollama list, and the order in their words:
    // cloud/strongest -> cloud/stronger -> cloud/strong -> cloud ->
    // non-cloud/strongest -> non-cloud/stronger -> ...
    test('asks every cloud model first, the bigger first, then the rest by size', () => {
        const flashCloud = genServerCandidate(
            'super-mac',
            'deepseek-v4.1-flash:cloud',
        );
        const bigCloud = genServerCandidate('super-mac', 'gemma4:31b-cloud');
        const smallCloud = genServerCandidate('super-mac', 'gemma4:4b-cloud');
        const cloud = genServerCandidate('super-mac', 'gemma4:cloud');
        const nine = genServerCandidate('super-mac', 'qwen3.5:9b');
        const twelve = genServerCandidate('super-mac', 'gemma4:12b');
        const e4b = genServerCandidate('super-mac', 'gemma4:e4b');
        const seventy = genServerCandidate('desk', 'llama3.3:70b');
        expect(
            toLabels(
                rankAutoCandidates(
                    [
                        flashCloud,
                        e4b,
                        bigCloud,
                        cloud,
                        FREE,
                        nine,
                        smallCloud,
                        twelve,
                        seventy,
                    ],
                    new Map(),
                ),
            ),
        ).toEqual([
            bigCloud.label,
            smallCloud.label,
            // No size in either name: the list's own order.
            flashCloud.label,
            cloud.label,
            seventy.label,
            twelve.label,
            nine.label,
            FREE.label,
            e4b.label,
        ]);
    });

    test('still leaves out a cloud model whose server does not answer, and puts a busy one at the back', () => {
        const bigCloud = genServerCandidate('super-mac', 'gemma4:31b-cloud');
        const unreachable = genStateMap([[bigCloud, { isReachable: false }]]);
        expect(
            toLabels(rankAutoCandidates([bigCloud, BIG, FREE], unreachable)),
        ).toEqual([BIG.label, FREE.label]);
        const options = {
            busyKeys: [toAutoBusyKey(bigCloud.provider, bigCloud.model)],
        };
        expect(
            toLabels(rankAutoCandidates([bigCloud, BIG], new Map(), options)),
        ).toEqual([BIG.label, bigCloud.label]);
    });

    test('keeps a preferred model ahead of a cloud one, and its cloud rows first', () => {
        const flashCloud = genServerCandidate(
            'super-mac',
            'deepseek-v4.1-flash:cloud',
        );
        const gemmaCloud = genServerCandidate('super-mac', 'gemma4:cloud');
        const gemmaSmall = genServerCandidate('laptop', 'google/gemma-4-e4b');
        expect(
            toLabels(
                rankAutoCandidates(
                    [flashCloud, gemmaSmall, gemmaCloud],
                    new Map(),
                    { preferModelPattern: /gemma[-_\s]?4/i },
                ),
            ),
        ).toEqual([gemmaCloud.label, gemmaSmall.label, flashCloud.label]);
    });

    test('leaves out a server that does not answer', () => {
        const stateMap = genStateMap([[BIG, { isReachable: false }]]);
        expect(
            toLabels(rankAutoCandidates([BIG, SMALL, FREE], stateMap)),
        ).toEqual([FREE.label, SMALL.label]);
    });

    test('puts a server this window is already asking at the back, not out', () => {
        const options = {
            busyKeys: [toAutoBusyKey(BIG.provider, BIG.model)],
        };
        // Both of that server's models: it is the server that is busy.
        expect(
            toLabels(
                rankAutoCandidates(
                    [BIG, NINE, FREE, SMALL],
                    new Map(),
                    options,
                ),
            ),
        ).toEqual([FREE.label, SMALL.label, BIG.label, NINE.label]);
        // And when it is all there is, it is still asked.
        expect(rankAutoCandidates([BIG], new Map(), options)).toEqual([BIG]);
    });

    test('puts one that just failed at the back until its time is up', () => {
        const now = 1_000_000;
        markAutoSetback(toAutoCandidateKey(BIG), now);
        expect(
            toLabels(
                rankAutoCandidates([BIG, FREE], new Map(), { now: now + 1 }),
            ),
        ).toEqual([FREE.label, BIG.label]);
        expect(
            toLabels(
                rankAutoCandidates([BIG, FREE], new Map(), {
                    now: now + 60 * 60 * 1000,
                }),
            ),
        ).toEqual([BIG.label, FREE.label]);
    });

    test('leaves out a model loaded with a context the request does not fit, except for a general question', () => {
        const stateMap = genStateMap([
            [BIG, { kind: 'ollama', isLoaded: true, loadedContext: 4096 }],
        ]);
        expect(toLabels(rankAutoCandidates([BIG, FREE], stateMap))).toEqual([
            FREE.label,
        ]);
        expect(
            toLabels(
                rankAutoCandidates([BIG, FREE], stateMap, { isGeneral: true }),
            ),
        ).toEqual([BIG.label, FREE.label]);
    });

    test('offers only what LM Studio has loaded, while it has something loaded', () => {
        const stateMap = genStateMap([
            [BIG, { kind: 'lm-studio', isLoaded: false, loadedContext: null }],
            [NINE, { kind: 'lm-studio', isLoaded: true, loadedContext: 32768 }],
        ]);
        expect(toLabels(rankAutoCandidates([BIG, NINE], stateMap))).toEqual([
            NINE.label,
        ]);
        // With nothing loaded there, every row is one the program may load
        // -- and the last resort, behind even a small model that is ready:
        // the biggest file on that disk may be one its card cannot hold.
        const idleMap = genStateMap([
            [BIG, { kind: 'lm-studio', isLoaded: false }],
            [NINE, { kind: 'lm-studio', isLoaded: false }],
        ]);
        expect(
            toLabels(rankAutoCandidates([NINE, BIG, SMALL, FREE], idleMap)),
        ).toEqual([FREE.label, SMALL.label, BIG.label, NINE.label]);
    });

    test('offers every row of a server that loads on the question, the loaded one first among equals', () => {
        const other = genServerCandidate('super-computer', 'other-12b');
        const stateMap = genStateMap([
            [BIG, { kind: 'ollama', isLoaded: false }],
            [other, { kind: 'ollama', isLoaded: true, loadedContext: 32768 }],
            [SMALL, { kind: 'ollama', isLoaded: true, loadedContext: 32768 }],
        ]);
        expect(
            toLabels(rankAutoCandidates([SMALL, BIG, other], stateMap)),
        ).toEqual([other.label, BIG.label, SMALL.label]);
    });

    // The user's order for an app shown in a language other than English
    // (2026-10-20, the app's own is Khmer): gemma4:cloud from any assistant,
    // then Free's Nemotron Super VL, then gemma4:31b, gemma4:12b, then any
    // free model -- Gemma 4 supports a language like Khmer well.
    describe('languageModelsFirst', () => {
        const option = { languageModelsFirst: true };
        const gemmaCloud = genServerCandidate('super-mac', 'gemma4:cloud');
        const freeVl = genFreeCandidate('nvidia/nemotron-3.5-super-vl:free');
        const gemma31 = genServerCandidate('super-mac', 'gemma4:31b');
        const gemma12 = genServerCandidate('desk', 'google/gemma-4-12b');
        const freeOther = genFreeCandidate('nvidia/nemotron-3.5-super:free');
        // Bigger than everything above: the plain size order's first pick.
        const seventy = genServerCandidate('desk', 'llama3.3:70b');

        test("asks the language-speaking models first, in the list's order", () => {
            expect(
                toLabels(
                    rankAutoCandidates(
                        [
                            freeOther,
                            gemma12,
                            seventy,
                            gemma31,
                            freeVl,
                            gemmaCloud,
                        ],
                        new Map(),
                        option,
                    ),
                ),
            ).toEqual([
                gemmaCloud.label,
                freeVl.label,
                gemma31.label,
                gemma12.label,
                freeOther.label,
                seventy.label,
            ]);
        });

        test('holds the tiers against the cloud and size rules', () => {
            // gemma4:31b-cloud is the 31b tier; another cloud, and a bigger
            // model, wait behind the whole list.
            const gemmaBigCloud = genServerCandidate(
                'super-mac',
                'gemma4:31b-cloud',
            );
            const otherCloud = genServerCandidate(
                'super-mac',
                'deepseek-v4.1-flash:cloud',
            );
            expect(
                toLabels(
                    rankAutoCandidates(
                        [
                            otherCloud,
                            seventy,
                            gemmaBigCloud,
                            freeVl,
                            gemmaCloud,
                        ],
                        new Map(),
                        option,
                    ),
                ),
            ).toEqual([
                gemmaCloud.label,
                freeVl.label,
                gemmaBigCloud.label,
                // No tier: a cloud model still before a plainly bigger one.
                otherCloud.label,
                seventy.label,
            ]);
        });

        test('never a model that cannot answer, and a setback still goes last', () => {
            const away = genStateMap([[gemmaCloud, { isReachable: false }]]);
            expect(
                toLabels(rankAutoCandidates([gemmaCloud, FREE], away, option)),
            ).toEqual([FREE.label]);
            const now = 1_000_000;
            markAutoSetback(toAutoCandidateKey(gemmaCloud), now);
            expect(
                toLabels(
                    rankAutoCandidates([gemmaCloud, FREE], new Map(), {
                        ...option,
                        now: now + 1,
                    }),
                ),
            ).toEqual([FREE.label, gemmaCloud.label]);
        });

        test('matches the wire id and the shown name, never a near miss', () => {
            expect(
                toLabels(
                    rankAutoCandidates(
                        [FREE, gemmaCloud, gemma31],
                        new Map(),
                        option,
                    ),
                ),
            ).toEqual([gemmaCloud.label, gemma31.label, FREE.label]);
            // `gemma4:31b-cloud` is not `gemma4:cloud`; a gemma-3 name is no
            // tier at all.
            const gemmaBigCloud = genServerCandidate(
                'super-mac',
                'gemma4:31b-cloud',
            );
            const gemma3Cloud = genServerCandidate('super-mac', 'gemma3:cloud');
            expect(
                toLabels(
                    rankAutoCandidates(
                        [gemma3Cloud, gemmaBigCloud, gemmaCloud],
                        new Map(),
                        option,
                    ),
                ),
            ).toEqual([
                gemmaCloud.label,
                gemmaBigCloud.label,
                gemma3Cloud.label,
            ]);
        });

        test('is off without the option: the plain size order stands', () => {
            expect(
                toLabels(
                    rankAutoCandidates(
                        [freeVl, gemmaCloud, gemma31],
                        new Map(),
                    ),
                ),
            ).toEqual([gemmaCloud.label, gemma31.label, freeVl.label]);
        });
    });

    test('asks only a model that can see when a picture rides the question', () => {
        const seeing = genFreeCandidate('stepfun/step-3.7-flash:free', {
            canSeeImages: true,
        });
        expect(
            toLabels(
                rankAutoCandidates([BIG, FREE, seeing], new Map(), {
                    needsImages: true,
                }),
            ),
        ).toEqual([seeing.label]);
    });

    test('keeps the list order among the free models', () => {
        const second = genFreeCandidate('nex-agi/nex-n2.5-pro:free');
        expect(toLabels(rankAutoCandidates([FREE, second], new Map()))).toEqual(
            [FREE.label, second.label],
        );
    });

    // The user's word for a verse that has to be translated: Gemma 4 first,
    // whatever its size -- but never one that cannot answer, and never an
    // LM Studio model that is not loaded.
    test('asks a preferred model first, among those that can answer', () => {
        const gemmaSmall = genServerCandidate('laptop', 'google/gemma-4-e4b');
        const options = { preferModelPattern: /gemma[-_\s]?4/i };
        expect(
            toLabels(
                rankAutoCandidates(
                    [NINE, FREE, gemmaSmall],
                    new Map(),
                    options,
                ),
            ),
        ).toEqual([gemmaSmall.label, NINE.label, FREE.label]);
        expect(
            toLabels(rankAutoCandidates([NINE, FREE, gemmaSmall], new Map())),
        ).toEqual([NINE.label, FREE.label, gemmaSmall.label]);
        const unloaded = genStateMap([
            [gemmaSmall, { kind: 'lm-studio', isLoaded: false }],
        ]);
        expect(
            toLabels(rankAutoCandidates([NINE, gemmaSmall], unloaded, options)),
        ).toEqual([NINE.label, gemmaSmall.label]);
        const unreachable = genStateMap([[gemmaSmall, { isReachable: false }]]);
        expect(
            toLabels(rankAutoCandidates([gemmaSmall], unreachable, options)),
        ).toEqual([]);
    });
});

describe('askWithAutoAssistant', () => {
    const neverFinal = () => {
        return false;
    };

    test('asks the first pick and says who answered', async () => {
        const ask = vi.fn(async (pick: AutoCandidateType) => {
            return `from ${pick.label}`;
        });
        const result = await askWithAutoAssistant({
            picks: [BIG, FREE],
            ask,
            checkIsFinal: neverFinal,
        });
        expect(result.answer).toBe(`from ${BIG.label}`);
        expect(result.pick).toBe(BIG);
        expect(result.skipped).toEqual([]);
        expect(ask).toHaveBeenCalledTimes(1);
    });

    test('moves on when the pick fails before answering, and remembers it', async () => {
        const result = await askWithAutoAssistant({
            picks: [BIG, FREE],
            ask: async (pick) => {
                if (pick === BIG) {
                    throw new Error(
                        'nothing answered at http://super:1234/v1.',
                    );
                }
                return 'answer';
            },
            checkIsFinal: neverFinal,
        });
        expect(result.pick).toBe(FREE);
        expect(result.skipped).toEqual([
            { pick: BIG, reason: 'nothing answered at http://super:1234/v1' },
        ]);
        expect(checkHasAutoSetback(toAutoCandidateKey(BIG))).toBe(true);
        expect(checkHasAutoSetback(toAutoCandidateKey(FREE))).toBe(false);
    });

    test('does not hand the question on once a round came back', async () => {
        // The model may have pressed something by then.
        const ask = vi.fn(
            async (_pick: AutoCandidateType, attempt: AutoAttemptType) => {
                attempt.hasRound = true;
                throw new Error('it went quiet');
            },
        );
        await expect(
            askWithAutoAssistant({
                picks: [BIG, FREE],
                ask,
                checkIsFinal: neverFinal,
            }),
        ).rejects.toThrow('it went quiet');
        expect(ask).toHaveBeenCalledTimes(1);
        expect(checkHasAutoSetback(toAutoCandidateKey(BIG))).toBe(true);
    });

    test('hands a read-only question on even after a round came back', async () => {
        const ask = vi.fn(
            async (pick: AutoCandidateType, attempt: AutoAttemptType) => {
                attempt.hasRound = true;
                if (pick === BIG) {
                    throw new Error('it wrote no answer this time');
                }
                return 'the file lists three videos';
            },
        );
        const result = await askWithAutoAssistant({
            picks: [BIG, FREE],
            ask,
            checkIsFinal: neverFinal,
            canHandOnAfterRound: true,
        });
        expect(result.answer).toBe('the file lists three videos');
        expect(result.pick).toBe(FREE);
        expect(result.skipped).toEqual([
            { pick: BIG, reason: 'it wrote no answer this time' },
        ]);
    });

    test('stops at a failure nobody else would change, and holds nothing against the pick', async () => {
        const stop = new Error('stopped');
        const ask = vi.fn(async () => {
            throw stop;
        });
        await expect(
            askWithAutoAssistant({
                picks: [BIG, FREE],
                ask,
                checkIsFinal: (error) => {
                    return error === stop;
                },
            }),
        ).rejects.toBe(stop);
        expect(ask).toHaveBeenCalledTimes(1);
        expect(checkHasAutoSetback(toAutoCandidateKey(BIG))).toBe(false);
    });

    test('asks a bounded number of assistants and throws the last failure', async () => {
        const picks = [BIG, NINE, SMALL, FREE];
        const ask = vi.fn(async (pick: AutoCandidateType) => {
            throw new Error(`${pick.label} failed`);
        });
        await expect(
            askWithAutoAssistant({ picks, ask, checkIsFinal: neverFinal }),
        ).rejects.toThrow(`${picks[AUTO_MAX_ATTEMPTS - 1].label} failed`);
        expect(ask).toHaveBeenCalledTimes(AUTO_MAX_ATTEMPTS);
    });

    test('says so when there is nobody to ask', async () => {
        await expect(
            askWithAutoAssistant({
                picks: [],
                ask: async () => {
                    return 'never';
                },
                checkIsFinal: neverFinal,
            }),
        ).rejects.toThrow(/no assistant that costs nothing/);
    });

    test('holds a slow answer against the pick, and a quick one clears it', async () => {
        let clock = 0;
        const now = () => {
            return clock;
        };
        await askWithAutoAssistant({
            picks: [BIG],
            ask: async () => {
                clock += AUTO_SLOW_MILLISECONDS + 1;
                return 'late';
            },
            checkIsFinal: neverFinal,
            now,
        });
        expect(checkHasAutoSetback(toAutoCandidateKey(BIG), clock)).toBe(true);
        await askWithAutoAssistant({
            picks: [BIG],
            ask: async () => {
                clock += 1000;
                return 'quick';
            },
            checkIsFinal: neverFinal,
            now,
        });
        expect(checkHasAutoSetback(toAutoCandidateKey(BIG), clock)).toBe(false);
    });
});

describe('genAutoAnswerNote', () => {
    test('says nothing over the first answer, nor while the same one answers', () => {
        expect(genAutoAnswerNote(BIG, [], undefined)).toBeNull();
        expect(genAutoAnswerNote(BIG, [], BIG.label)).toBeNull();
    });

    test('says when another assistant answered than the one before', () => {
        expect(genAutoAnswerNote(FREE, [], BIG.label)).toBe(
            `Auto asked ${FREE.label} this time.`,
        );
    });

    test('says who could not answer, why, and who did', () => {
        expect(
            genAutoAnswerNote(
                FREE,
                [
                    { pick: BIG, reason: 'nothing answered' },
                    { pick: NINE, reason: '' },
                ],
                BIG.label,
            ),
        ).toBe(
            `${BIG.label} could not answer — nothing answered. ` +
                `${NINE.label} could not answer. ` +
                `Auto asked ${FREE.label} instead.`,
        );
    });
});

describe('orderHandOnPicks', () => {
    const LOCAL = genServerCandidate('local-ollama', 'gemma4:31b');
    const LOCAL_SMALL = genServerCandidate('local-ollama', 'gemma4:e4b');
    const SHARED = genServerCandidate('registry-church', 'gemma4:27b');
    const inBuildingIdSet = new Set(['local-ollama', 'super-computer']);
    const checkIsInBuilding = (candidate: AutoCandidateType) => {
        return (
            candidate.serverId !== null &&
            inBuildingIdSet.has(candidate.serverId)
        );
    };

    test('leaves out the one that failed and keeps Auto order otherwise', () => {
        expect(
            toLabels(
                orderHandOnPicks([FREE, LOCAL, BIG], FREE, checkIsInBuilding),
            ),
        ).toEqual([LOCAL.label, BIG.label]);
    });

    test('asks the rest of the building before anything outside it', () => {
        expect(
            toLabels(
                orderHandOnPicks(
                    [FREE, SHARED, LOCAL, LOCAL_SMALL, BIG],
                    LOCAL,
                    checkIsInBuilding,
                ),
            ),
        ).toEqual([LOCAL_SMALL.label, BIG.label, FREE.label, SHARED.label]);
    });

    test('hands on to nobody when there is nobody else', () => {
        expect(orderHandOnPicks([LOCAL], LOCAL, checkIsInBuilding)).toEqual([]);
    });
});

describe('genHandOnAnswerNote', () => {
    test('names who failed and why, everyone skipped, and who answered', () => {
        expect(
            genHandOnAnswerNote(
                {
                    pick: SMALL,
                    reason:
                        'its server is not answering — check that it is ' +
                        'running on this computer',
                },
                FREE,
                [{ pick: BIG, reason: '' }],
            ),
        ).toBe(
            `${SMALL.label} could not answer — its server is not answering ` +
                '— check that it is running on this computer. ' +
                `${BIG.label} could not answer. ` +
                `${FREE.label} answered instead.`,
        );
    });

    test('says the same sentences describeSkippedAssistants gives', () => {
        expect(describeSkippedAssistants([])).toBe('');
        expect(
            describeSkippedAssistants([{ pick: NINE, reason: 'busy' }]),
        ).toBe(`${NINE.label} could not answer — busy.`);
    });
});

describe('the buttons that change who this chat asks', () => {
    test('offer the one that answered, then Auto', () => {
        const actions = genAssistantSwitchActions(NINE);
        expect(actions).toEqual([
            {
                label: `Use ${NINE.label} for this chat`,
                toolName: USE_ASSISTANT_TOOL_NAME,
                args: { provider: 'custom', model: NINE.model },
            },
            {
                label: USE_AUTO_LABEL,
                toolName: USE_ASSISTANT_TOOL_NAME,
                args: { auto: true },
            },
        ]);
        // Every button reads back as the choice it was written for.
        expect(readAssistantSwitch(actions[0].args)).toEqual({
            isAuto: false,
            provider: 'custom',
            model: NINE.model,
        });
        expect(readAssistantSwitch(actions[1].args)).toEqual({ isAuto: true });
    });

    test('a saved button can name no paid key and nothing that is not a model', () => {
        expect(
            readAssistantSwitch({ provider: 'anthropic', model: 'claude' }),
        ).toBeNull();
        expect(readAssistantSwitch({ provider: 'free', model: '' })).toBeNull();
        expect(
            readAssistantSwitch({ provider: 'free', model: 'x'.repeat(201) }),
        ).toBeNull();
        expect(readAssistantSwitch({ auto: 'yes' })).toBeNull();
        expect(readAssistantSwitch(null)).toBeNull();
        expect(readAssistantSwitch('auto')).toBeNull();
        expect(
            readAssistantSwitch({ provider: 'free', model: FREE.model }),
        ).toEqual({ isAuto: false, provider: 'free', model: FREE.model });
    });
});
