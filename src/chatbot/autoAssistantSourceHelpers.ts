// What the Auto row has to choose FROM, read live: the user's servers that
// cost nothing, the keyless service's models, and what each server says of
// itself in front of the question. The choosing is `autoAssistantHelpers`,
// which this hands its findings to; it is kept apart so the policy can be
// tested with no setting store and no relay.

import {
    checkIsCustomServerAnswering,
    findCustomModelInfo,
    getUsableCustomServers,
    readCustomServerModelInfo,
} from '../helper/ai/customServerHelpers';
import type { CustomServerType } from '../../electron/customLlmProtocol';

import {
    rankAutoCandidates,
    toAutoCandidateKey,
    type AutoCandidateStateType,
    type AutoCandidateType,
    type AutoRankOptionsType,
} from './autoAssistantHelpers';
import {
    checkCanSeeImages,
    checkIsNoCostCustomServer,
    getLlmModelList,
    getLlmProviderLabel,
} from './llmBotHelpers';

function getNoCostServers(): CustomServerType[] {
    return getUsableCustomServers().filter(checkIsNoCostCustomServer);
}

/**
 * Every assistant Auto may ask, in the order the two pickers list them: each
 * no-cost server's models, then the keyless service's. Read fresh -- the
 * servers are edited in another window, and the shared ones come and go.
 */
export function genAutoCandidates(): AutoCandidateType[] {
    const serverMap = new Map(
        getNoCostServers().map((server) => {
            return [server.id, server];
        }),
    );
    const candidates: AutoCandidateType[] = [];
    for (const one of getLlmModelList('custom')) {
        const server =
            one.serverId === undefined
                ? undefined
                : serverMap.get(one.serverId);
        if (server === undefined) {
            continue;
        }
        candidates.push({
            provider: 'custom',
            model: one.id,
            serverId: server.id,
            label: `${server.name} · ${one.label}`,
            modelName: `${one.wireId ?? ''} ${one.label}`,
            canSeeImages: checkCanSeeImages('custom', one.id),
        });
    }
    const freeLabel = getLlmProviderLabel('free');
    for (const one of getLlmModelList('free')) {
        candidates.push({
            provider: 'free',
            model: one.id,
            serverId: null,
            label: `${freeLabel} · ${one.label}`,
            modelName: one.id,
            canSeeImages: checkCanSeeImages('free', one.id),
        });
    }
    return candidates;
}

// The whole look, every server at once. Long enough for a machine on the
// same network to answer -- a bare machine name took more than 1.5 s to
// resolve cold on the first live try of the custom servers -- and it is paid
// in full only when a server answers nothing at all, which the memory below
// then spares the next questions.
const PROBE_WAIT_MILLISECONDS = 4000;
// A server that answered nothing is not asked again for this long: the
// commonest state of a list of eight is that half of them are switched off,
// and each question must not wait on them afresh.
const AWAY_MILLISECONDS = 5 * 60 * 1000;

// By server id; bounded by the servers there are.
const awayUntilMap = new Map<string, number>();

/** The Reload beside the list: look at every server again. */
export function clearAutoAwayServers() {
    awayUntilMap.clear();
}

function checkIsAway(serverId: string, now: number) {
    const until = awayUntilMap.get(serverId);
    if (until === undefined) {
        return false;
    }
    if (until <= now) {
        awayUntilMap.delete(serverId);
        return false;
    }
    return true;
}

/**
 * What each candidate's server says right now, by `toAutoCandidateKey`: that
 * it answers at all, which program it is, and of each model whether it is in
 * memory and with what context. The keyless service is not asked -- it has
 * no door that says, and a question is the only test of it.
 */
export async function probeAutoCandidates(
    candidates: readonly AutoCandidateType[],
): Promise<Map<string, AutoCandidateStateType>> {
    const now = Date.now();
    const serverIds = new Set(
        candidates.flatMap((candidate) => {
            return candidate.serverId === null ? [] : [candidate.serverId];
        }),
    );
    const servers = getNoCostServers().filter((server) => {
        return serverIds.has(server.id);
    });
    const found = await Promise.all(
        servers.map(async (server) => {
            if (checkIsAway(server.id, now)) {
                return { server, isReachable: false, info: null };
            }
            const [isReachable, info] = await Promise.all([
                checkIsCustomServerAnswering(server, PROBE_WAIT_MILLISECONDS),
                readCustomServerModelInfo(server, PROBE_WAIT_MILLISECONDS),
            ]);
            if (!isReachable) {
                awayUntilMap.set(server.id, Date.now() + AWAY_MILLISECONDS);
            }
            return { server, isReachable, info };
        }),
    );
    const stateMap = new Map<string, AutoCandidateStateType>();
    for (const { server, isReachable, info } of found) {
        const rowMap = new Map(
            server.models.map((row) => {
                return [row.id, row.model];
            }),
        );
        for (const candidate of candidates) {
            if (candidate.serverId !== server.id) {
                continue;
            }
            const rowId = candidate.model.slice(server.id.length + 1);
            const modelInfo = isReachable
                ? findCustomModelInfo(info, rowMap.get(rowId) ?? '')
                : null;
            stateMap.set(toAutoCandidateKey(candidate), {
                isReachable,
                kind: isReachable ? (info?.kind ?? null) : null,
                isLoaded: modelInfo?.isLoaded ?? null,
                loadedContext: modelInfo?.loadedContext ?? null,
            });
        }
    }
    return stateMap;
}

/**
 * Who to ask this question, best first: the servers are looked at, and the
 * candidates ranked on what they said.
 */
export async function resolveAutoPicks(
    options: AutoRankOptionsType = {},
): Promise<AutoCandidateType[]> {
    const candidates = genAutoCandidates();
    const stateMap = await probeAutoCandidates(candidates);
    return rankAutoCandidates(candidates, stateMap, options);
}

/**
 * The likeliest pick with NOTHING asked of any server -- what a tab is put
 * on the moment Auto is chosen, so everything that reads the tab's provider
 * has one to read before the first question settles it for real.
 */
export function guessAutoPick(): AutoCandidateType | null {
    return rankAutoCandidates(genAutoCandidates(), new Map())[0] ?? null;
}
