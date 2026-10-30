import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    REPORT_QUEUE_MAX_AGE_MILLISECONDS,
    REPORT_QUEUE_MAX_BYTES,
    REPORT_QUEUE_MAX_COUNT,
    queueReportBody,
    resetReportQueueForTests,
    sendQueuedReports,
    type ReportQueueDepsType,
} from './llmReportQueueHelpers';

let dirPath: string;

function genBody(reference: string, words = 'the screen went blank') {
    return JSON.stringify({
        version: 1,
        reference,
        prompt: `----- BEGIN REPORT ${reference} -----\n${words}`,
        attachments: [],
    });
}

function genDeps(value: Partial<ReportQueueDepsType> = {}) {
    let now = 1_800_000_000_000;
    return {
        dirPath,
        deliver: vi.fn(async (_body: string): Promise<any> => {
            return { ok: true };
        }),
        isAiEnabled: () => true,
        now: () => {
            return now;
        },
        tick: (milliseconds: number) => {
            now += milliseconds;
        },
        ...value,
    };
}

function listNames() {
    return fs.readdirSync(dirPath).sort();
}

beforeEach(() => {
    resetReportQueueForTests();
    dirPath = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), 'report-queue-test-')),
        'pending-reports',
    );
});

afterEach(() => {
    fs.rmSync(path.dirname(dirPath), { recursive: true, force: true });
});

// A report pressed while the server was asleep is a report lost, unless it
// is kept.
describe('keeping a report for later', () => {
    it('keeps the exact body under its reference, in a folder made for it', async () => {
        const deps = genDeps();
        const body = genBody('OWA-261015-0001');
        expect(await queueReportBody(body, deps)).toBe(true);
        expect(listNames()).toEqual(['1800000000000-OWA-261015-0001.json']);
        expect(
            fs.readFileSync(path.join(dirPath, listNames()[0]), 'utf8'),
        ).toBe(body);
    });

    it('keeps one copy of a report sent again, and five reports at most', async () => {
        const deps = genDeps();
        await queueReportBody(genBody('OWA-261015-0001', 'first'), deps);
        deps.tick(1000);
        // Send pressed again on the same report: the newer copy replaces it.
        await queueReportBody(genBody('OWA-261015-0001', 'again'), deps);
        expect(listNames()).toEqual(['1800000001000-OWA-261015-0001.json']);
        for (let index = 2; index <= REPORT_QUEUE_MAX_COUNT + 2; index++) {
            deps.tick(1000);
            await queueReportBody(
                genBody(`OWA-261015-000${index.toString()}`),
                deps,
            );
        }
        // Over the bound the OLDEST go; the one just kept stays.
        const names = listNames();
        expect(names).toHaveLength(REPORT_QUEUE_MAX_COUNT);
        expect(names[0]).toContain('OWA-261015-0003');
        expect(names[names.length - 1]).toContain('OWA-261015-0007');
    });

    it('says so, and throws nothing, when it cannot keep it', async () => {
        // A folder that cannot be made: a FILE sits where it should be.
        fs.mkdirSync(path.dirname(dirPath), { recursive: true });
        fs.writeFileSync(dirPath, 'not a folder');
        expect(
            await queueReportBody(genBody('OWA-261015-0001'), genDeps()),
        ).toBe(false);
    });
});

describe('sending what was kept', () => {
    it('sends the oldest first and lets go of each one taken', async () => {
        const deps = genDeps();
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        deps.tick(1000);
        await queueReportBody(genBody('OWA-261015-0002'), deps);
        expect(await sendQueuedReports(deps)).toEqual({
            sent: ['OWA-261015-0001', 'OWA-261015-0002'],
            left: 0,
        });
        expect(
            deps.deliver.mock.calls.map(
                (call) => JSON.parse(call[0]).reference,
            ),
        ).toEqual(['OWA-261015-0001', 'OWA-261015-0002']);
        expect(listNames()).toEqual([]);
    });

    // Asking a server that is away five times in a row changes nothing.
    it('stops at the first one the server is still away for, and keeps the rest', async () => {
        const deps = genDeps();
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        deps.tick(1000);
        await queueReportBody(genBody('OWA-261015-0002'), deps);
        deps.deliver.mockResolvedValue({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
        });
        expect(await sendQueuedReports(deps)).toEqual({ sent: [], left: 2 });
        expect(deps.deliver).toHaveBeenCalledTimes(1);
    });

    it('lets go of what can never be taken, and of what is a week old', async () => {
        const deps = genDeps();
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        deps.tick(1000);
        await queueReportBody(genBody('OWA-261015-0002'), deps);
        deps.tick(1000);
        await queueReportBody(genBody('OWA-261015-0003'), deps);
        // Too large: no later try will be smaller.
        deps.deliver.mockResolvedValueOnce({
            ok: false,
            reason: 'too-large',
            detail: 'the report server said it is too large',
        });
        expect(await sendQueuedReports(deps)).toEqual({
            sent: ['OWA-261015-0002', 'OWA-261015-0003'],
            left: 0,
        });
        // A week on, a kept report is let go of unsent.
        await queueReportBody(genBody('OWA-261015-0004'), deps);
        deps.tick(REPORT_QUEUE_MAX_AGE_MILLISECONDS + 1);
        deps.deliver.mockClear();
        expect(await sendQueuedReports(deps)).toEqual({ sent: [], left: 0 });
        expect(deps.deliver).not.toHaveBeenCalled();
    });

    it('sends nothing while AI is off, and keeps it for when it is on', async () => {
        const deps = genDeps({ isAiEnabled: () => false });
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        expect(await sendQueuedReports(deps)).toEqual({ sent: [], left: 1 });
        expect(deps.deliver).not.toHaveBeenCalled();
    });

    it('never runs twice at once, and an empty folder is nothing to do', async () => {
        expect(await sendQueuedReports(genDeps())).toEqual({
            sent: [],
            left: 0,
        });
        const deps = genDeps();
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        let release: (value: any) => void = () => {};
        deps.deliver.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );
        const first = sendQueuedReports(deps);
        // Let the first reach its delivery before the second starts.
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });
        expect(await sendQueuedReports(deps)).toEqual({ sent: [], left: 1 });
        release({ ok: true });
        expect(await first).toEqual({ sent: ['OWA-261015-0001'], left: 0 });
        expect(deps.deliver).toHaveBeenCalledTimes(1);
    });
});

describe('what the folder holds besides kept reports', () => {
    it('keeps nothing too big to send later, and makes no folder for it', async () => {
        const body = 'x'.repeat(REPORT_QUEUE_MAX_BYTES + 1);
        expect(await queueReportBody(body, genDeps())).toBe(false);
        expect(fs.existsSync(dirPath)).toBe(false);
    });

    it('leaves a file it did not write alone', async () => {
        const deps = genDeps();
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(path.join(dirPath, 'notes.txt'), 'mine');
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        expect(await sendQueuedReports(deps)).toEqual({
            sent: ['OWA-261015-0001'],
            left: 0,
        });
        expect(listNames()).toEqual(['notes.txt']);
    });

    it('never drops the report just kept, even when the clock went back', async () => {
        const deps = genDeps();
        for (let index = 1; index <= REPORT_QUEUE_MAX_COUNT; index++) {
            deps.tick(1000);
            await queueReportBody(
                genBody(`OWA-261015-000${index.toString()}`),
                deps,
            );
        }
        // Kept at a time older than every other: it sorts first.
        deps.tick(-60 * 1000);
        await queueReportBody(genBody('OWA-261015-0009'), deps);
        const names = listNames();
        expect(names).toHaveLength(REPORT_QUEUE_MAX_COUNT);
        expect(names[0]).toContain('OWA-261015-0009');
        // The oldest of the others went in its place.
        expect(names.join()).not.toContain('OWA-261015-0001');
    });

    it('skips one it cannot read and sends the next', async () => {
        const deps = genDeps();
        // A folder named like a report kept a second earlier: it sorts first,
        // is not a week old, and cannot be read.
        fs.mkdirSync(path.join(dirPath, '1799999999000-OWA-261015-0000.json'), {
            recursive: true,
        });
        await queueReportBody(genBody('OWA-261015-0001'), deps);
        expect(await sendQueuedReports(deps)).toEqual({
            sent: ['OWA-261015-0001'],
            left: 1,
        });
        expect(deps.deliver).toHaveBeenCalledTimes(1);
    });
});
