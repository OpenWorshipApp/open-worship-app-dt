import fs from 'node:fs/promises';
import path from 'node:path';

import type { LlmReportPostResultType } from './customLlmProtocol';

/**
 * Reports kept for later, when the report server could not be reached at
 * the moment Send was pressed (2026-10-15).
 *
 * The inbox an admin runs is a quick tunnel on an ordinary computer: it
 * sleeps, it restarts, its address moves. On 2026-10-14 it was away for a
 * day and a half, and every report pressed in that time was "not sent --
 * here is how to email it", which almost nobody does: a report not sent at
 * the press is a report lost. So a report that met an absent server --
 * `unreachable` or `timeout`, never a refusal -- is kept HERE, the exact
 * bytes that were to be posted (its files read at the press, so nothing
 * depends on them still being on the disk), and sent again by itself:
 * a minute after the app starts, every half hour while it runs, and at once
 * after any report goes through (the server is plainly back).
 *
 * Bounded, because it is disk on somebody's computer and nobody looks in
 * it: five reports, sixty megabytes, a week. The person pressed Send, so
 * sending later is what they asked for; the AI switch is asked again at
 * every try, and while it is off nothing goes.
 */

export const REPORT_QUEUE_MAX_COUNT = 5;
export const REPORT_QUEUE_MAX_BYTES = 60 * 1024 * 1024;
export const REPORT_QUEUE_MAX_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
export const REPORT_QUEUE_FIRST_TRY_DELAY_MILLISECONDS = 60 * 1000;
export const REPORT_QUEUE_RETRY_EVERY_MILLISECONDS = 30 * 60 * 1000;

// What an absent server looks like. A server that ANSWERED no -- a
// refusal, too large -- will not say yes later.
export const QUEUED_REASON_LIST: readonly string[] = ['unreachable', 'timeout'];

const FILE_NAME_PATTERN = /^(\d{13})-([A-Za-z0-9-]{1,40})\.json$/;
const REFERENCE_PATTERN = /"reference":"(OWA-\d{6}-[0-9a-f]{4})"/;

export type ReportQueueDepsType = {
    dirPath: string;
    deliver: (body: string) => Promise<LlmReportPostResultType>;
    isAiEnabled: () => boolean;
    now?: () => number;
};

type QueuedReportType = {
    filePath: string;
    reference: string;
    queuedAt: number;
    bytes: number;
};

async function listQueued(dirPath: string): Promise<QueuedReportType[]> {
    let names: string[];
    try {
        names = await fs.readdir(dirPath);
    } catch (_error) {
        return [];
    }
    const queued: QueuedReportType[] = [];
    for (const name of names) {
        const matched = FILE_NAME_PATTERN.exec(name);
        if (matched === null) {
            continue;
        }
        const filePath = path.join(dirPath, name);
        try {
            const { size } = await fs.stat(filePath);
            queued.push({
                filePath,
                reference: matched[2],
                queuedAt: Number(matched[1]),
                bytes: size,
            });
        } catch (_error) {
            // Gone between the listing and the look: nothing to keep.
        }
    }
    return queued.sort((one, other) => {
        return one.queuedAt - other.queuedAt;
    });
}

async function removeQuietly(filePath: string) {
    await fs.rm(filePath, { force: true }).catch(() => {});
}

/**
 * Keeps one report's body to be sent later. A report already kept under the
 * same reference is replaced (Send pressed again). Answers whether it is
 * kept; never throws.
 */
export async function queueReportBody(
    body: string,
    deps: ReportQueueDepsType,
): Promise<boolean> {
    const bytes = Buffer.byteLength(body);
    if (bytes > REPORT_QUEUE_MAX_BYTES) {
        return false;
    }
    const now = deps.now ?? Date.now;
    const reference = REFERENCE_PATTERN.exec(body)?.[1] ?? 'report';
    try {
        await fs.mkdir(deps.dirPath, { recursive: true });
        for (const one of await listQueued(deps.dirPath)) {
            if (one.reference === reference && reference !== 'report') {
                await removeQuietly(one.filePath);
            }
        }
        const filePath = path.join(
            deps.dirPath,
            `${now().toString()}-${reference}.json`,
        );
        await fs.writeFile(filePath, body, 'utf8');
        // Over either bound, the OLDEST go: the one just kept is the one
        // somebody is looking at the answer about.
        const queued = await listQueued(deps.dirPath);
        let total = queued.reduce((sum, one) => {
            return sum + one.bytes;
        }, 0);
        let count = queued.length;
        for (const one of queued) {
            if (
                count <= REPORT_QUEUE_MAX_COUNT &&
                total <= REPORT_QUEUE_MAX_BYTES
            ) {
                break;
            }
            if (one.filePath === filePath) {
                continue;
            }
            await removeQuietly(one.filePath);
            count -= 1;
            total -= one.bytes;
        }
        return true;
    } catch (_error) {
        return false;
    }
}

let isSending = false;

/**
 * Sends what is kept, oldest first. Stops at the first report the server
 * still does not take -- it is away, and asking it five times in a row
 * changes nothing -- and lets go of what is a week old, and of what a
 * server answered can never be taken (too large, not a report). Answers the
 * references sent and how many are left. Never throws; never runs twice at
 * once.
 */
export async function sendQueuedReports(
    deps: ReportQueueDepsType,
): Promise<{ sent: string[]; left: number }> {
    const sent: string[] = [];
    if (isSending) {
        return { sent, left: (await listQueued(deps.dirPath)).length };
    }
    isSending = true;
    try {
        const now = deps.now ?? Date.now;
        for (const one of await listQueued(deps.dirPath)) {
            if (now() - one.queuedAt > REPORT_QUEUE_MAX_AGE_MILLISECONDS) {
                await removeQuietly(one.filePath);
                continue;
            }
            if (!deps.isAiEnabled()) {
                break;
            }
            let body: string;
            try {
                body = await fs.readFile(one.filePath, 'utf8');
            } catch (_error) {
                continue;
            }
            const result = await deps.deliver(body);
            if (result.ok) {
                await removeQuietly(one.filePath);
                sent.push(one.reference);
                continue;
            }
            if (
                result.reason === 'too-large' ||
                result.reason === 'not-allowed'
            ) {
                await removeQuietly(one.filePath);
                continue;
            }
            break;
        }
        return { sent, left: (await listQueued(deps.dirPath)).length };
    } finally {
        isSending = false;
    }
}

/** Tests only. */
export function resetReportQueueForTests() {
    isSending = false;
}
