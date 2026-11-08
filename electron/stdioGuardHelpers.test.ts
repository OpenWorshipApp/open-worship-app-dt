import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { checkIsBrokenPipeError, guardBrokenPipes } from './stdioGuardHelpers';

function genError(code: string) {
    return Object.assign(new Error(`write ${code}`), { code });
}

describe('a log line into a closed pipe', () => {
    it('tells a broken pipe from any other error', () => {
        expect(checkIsBrokenPipeError(genError('EPIPE'))).toBe(true);
        expect(checkIsBrokenPipeError(genError('ERR_STREAM_DESTROYED'))).toBe(
            true,
        );
        expect(checkIsBrokenPipeError(genError('EACCES'))).toBe(false);
        expect(checkIsBrokenPipeError(new Error('no code'))).toBe(false);
        expect(checkIsBrokenPipeError(null)).toBe(false);
    });

    it('is ignored on a guarded stream, and anything else still throws', () => {
        const stream = new EventEmitter();
        // Unguarded, an 'error' nobody listens for is thrown.
        expect(() => stream.emit('error', genError('EPIPE'))).toThrow(
            'write EPIPE',
        );
        guardBrokenPipes([stream as any, undefined]);
        expect(() => stream.emit('error', genError('EPIPE'))).not.toThrow();
        expect(() => stream.emit('error', genError('EACCES'))).toThrow(
            'write EACCES',
        );
    });

    it('lets a real stream whose reader is gone be written to', async () => {
        const closed = new Writable({
            write(_chunk, _encoding, callback) {
                callback(genError('EPIPE'));
            },
        });
        guardBrokenPipes([closed]);
        const uncaught: unknown[] = [];
        const onUncaught = (error: unknown) => {
            uncaught.push(error);
        };
        process.on('uncaughtException', onUncaught);
        try {
            closed.write('Setting saved\n');
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });
        } finally {
            process.off('uncaughtException', onUncaught);
        }
        expect(uncaught).toEqual([]);
    });
});
