import { describe, expect, it, vi } from 'vitest';

import {
    flushPendingEdits,
    registerPendingEditFlusher,
} from './pendingEditFlushHelpers';

describe('pending edit flushers', () => {
    it('does nothing for a document no editor is holding edits for', () => {
        expect(() => flushPendingEdits('/nobody.slides')).not.toThrow();
    });

    it('flushes only the edits held for that document, in registration order', () => {
        const order: string[] = [];
        const unregisterTop = registerPendingEditFlusher('/a.slides', () => {
            order.push('a:top');
        });
        const unregisterOther = registerPendingEditFlusher('/b.slides', () => {
            order.push('b');
        });
        const unregisterLeft = registerPendingEditFlusher('/a.slides', () => {
            order.push('a:left');
        });
        flushPendingEdits('/a.slides');
        expect(order).toEqual(['a:top', 'a:left']);
        unregisterTop();
        unregisterOther();
        unregisterLeft();
    });

    it('stops flushing an editor once it unregisters, and forgets an empty document', () => {
        const first = vi.fn();
        const second = vi.fn();
        const unregisterFirst = registerPendingEditFlusher('/c.slides', first);
        const unregisterSecond = registerPendingEditFlusher(
            '/c.slides',
            second,
        );
        unregisterFirst();
        flushPendingEdits('/c.slides');
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
        unregisterSecond();
        flushPendingEdits('/c.slides');
        expect(second).toHaveBeenCalledOnce();
        // a later editor on the same document starts afresh
        const third = vi.fn();
        const unregisterThird = registerPendingEditFlusher('/c.slides', third);
        flushPendingEdits('/c.slides');
        expect(third).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
        unregisterThird();
    });

    it('lets a flusher unregister itself while the document is being flushed', () => {
        const calls: string[] = [];
        const unregisterSelf = registerPendingEditFlusher('/d.slides', () => {
            calls.push('self');
            unregisterSelf();
        });
        const unregisterNext = registerPendingEditFlusher('/d.slides', () => {
            calls.push('next');
        });
        flushPendingEdits('/d.slides');
        expect(calls).toEqual(['self', 'next']);
        flushPendingEdits('/d.slides');
        expect(calls).toEqual(['self', 'next', 'next']);
        unregisterNext();
    });
});
