import { describe, expect, test } from 'vitest';
import {
    ensureCanvasItemUuids,
    ensureDocumentCanvasItemUuids,
    renewCanvasItemUuids,
    toCanvasItemUuid,
} from './canvasItemIdentityHelpers';

describe('canvas item identity', () => {
    test('repairs missing, invalid and duplicate identities deterministically without mutating the file', () => {
        const uuid = crypto.randomUUID();
        const input = [
            { id: 1 },
            { id: 2, uuid },
            { id: 3, uuid },
            { id: 4, uuid: 'bad' },
        ];
        const items = ensureCanvasItemUuids(input);
        expect(new Set(items.map((item) => item.uuid)).size).toBe(4);
        expect(
            items.every((item) => toCanvasItemUuid(item.uuid) !== undefined),
        ).toBe(true);
        expect(items[1].uuid).toBe(uuid);
        expect(items).toEqual(ensureCanvasItemUuids(structuredClone(input)));
        expect(input[0]).not.toHaveProperty('uuid');
        expect(input[2].uuid).toBe(uuid);
        expect(ensureCanvasItemUuids(items)).toBe(items);
    });

    test('reserves existing UUIDs before filling old items and canonicalizes case', () => {
        const reserved = '00000000-0000-4000-8000-000000000001';
        const input = [{ uuid: undefined }, { uuid: reserved.toUpperCase() }];
        const items = ensureCanvasItemUuids(input);
        expect(items[0].uuid).not.toBe(reserved);
        expect(items[1].uuid).toBe(reserved);
        expect(toCanvasItemUuid(42)).toBeUndefined();
    });

    test('repairs collisions between slides across a whole document and keeps canonical files unchanged', () => {
        const uuid = crypto.randomUUID();
        const reserved = '00000000-0000-4000-8000-000000000001';
        const slides = [
            { id: 1, canvasItems: [{ id: 1, uuid }] },
            {
                id: 2,
                canvasItems: [
                    { id: 1, uuid },
                    { id: 2 },
                    { id: 3, uuid: reserved },
                ],
            },
        ];
        const repaired = ensureDocumentCanvasItemUuids(slides);
        const uuids = repaired.flatMap((slide) =>
            slide.canvasItems.map((item) => item.uuid),
        );
        expect(new Set(uuids).size).toBe(4);
        expect(repaired[0]).toBe(slides[0]);
        expect(repaired[1].canvasItems[2].uuid).toBe(reserved);
        expect(repaired).toEqual(
            ensureDocumentCanvasItemUuids(structuredClone(slides)),
        );
        expect(ensureDocumentCanvasItemUuids(repaired)).toBe(repaired);
        expect(slides[1].canvasItems[0].uuid).toBe(uuid);
        expect(slides[1].canvasItems[1]).not.toHaveProperty('uuid');
    });

    test('copied slides renew item UUIDs while keeping content and transitions', () => {
        const original = [
            {
                uuid: crypto.randomUUID(),
                text: 'Words',
                transitionEffect: 'zoom',
            },
        ];
        const first = renewCanvasItemUuids(original);
        const second = renewCanvasItemUuids(original);
        expect(
            new Set([original[0].uuid, first[0].uuid, second[0].uuid]).size,
        ).toBe(3);
        expect(first[0]).toMatchObject({
            text: 'Words',
            transitionEffect: 'zoom',
        });
        expect(toCanvasItemUuid(first[0].uuid)).toBe(first[0].uuid);
    });
});
