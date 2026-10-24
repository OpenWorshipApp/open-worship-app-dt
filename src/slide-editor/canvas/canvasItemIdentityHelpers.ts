// UUIDs are scoped to a document file. Numeric ids remain slide-local editor
// selection handles; UUIDs are persistent handles for presentation/animation.
export function toCanvasItemUuid(value: unknown): string | undefined {
    return typeof value === 'string' &&
        /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
            value,
        )
        ? value.toLowerCase()
        : undefined;
}

/**
 * Repair old documents without marking them dirty merely by opening them.
 * Legacy identities are deterministic, so the saved baseline,
 * history and separate screen windows all agree. New items use random UUIDs.
 * Returns the original array when it already has unique, canonical UUIDs.
 */
export function ensureCanvasItemUuids<T extends { uuid?: string }>(
    items: T[],
): T[] {
    if (items.length === 0) {
        return items;
    }
    const canonical = new Set<string>();
    const isAlreadyUnique = items.every((item) => {
        const uuid = toCanvasItemUuid(item.uuid);
        if (uuid === undefined || uuid !== item.uuid || canonical.has(uuid)) {
            return false;
        }
        canonical.add(uuid);
        return true;
    });
    if (isAlreadyUnique) {
        return items;
    }
    const reserved = new Set(items.map((item) => toCanvasItemUuid(item.uuid)));
    const used = new Set<string>();
    let legacyIndex = 0;
    const repaired = items.map((item) => {
        let uuid = toCanvasItemUuid(item.uuid);
        if (uuid === undefined || used.has(uuid)) {
            do {
                uuid = `00000000-0000-4000-8000-${(++legacyIndex).toString(16).padStart(12, '0')}`;
            } while (reserved.has(uuid) || used.has(uuid));
        }
        used.add(uuid);
        if (uuid === item.uuid) {
            return item;
        }
        return { ...item, uuid };
    });
    return repaired;
}

/** Normalize across every slide, preserving existing unique item identities. */
export function ensureDocumentCanvasItemUuids<
    T extends { canvasItems: { uuid?: string }[] },
>(slides: T[]): T[] {
    const used = new Set<string>();
    if (
        slides.every((slide) =>
            slide.canvasItems.every((item) => {
                const uuid = toCanvasItemUuid(item.uuid);
                if (
                    uuid === undefined ||
                    uuid !== item.uuid ||
                    used.has(uuid)
                ) {
                    return false;
                }
                used.add(uuid);
                return true;
            }),
        )
    ) {
        return slides;
    }
    // Only migration/repair allocates the flattened list. Reserve valid IDs
    // throughout the file before filling gaps, including on later slides.
    const items = ensureCanvasItemUuids(
        slides.flatMap((slide) => slide.canvasItems),
    );
    let index = 0;
    return slides.map((slide) => {
        let changed = false;
        const canvasItems = slide.canvasItems.map((item) => {
            const repaired = items[index++];
            changed ||= repaired !== item;
            return repaired;
        });
        return changed ? { ...slide, canvasItems } : slide;
    });
}

/** A copied slide contains new items, even when it came from another file. */
export function renewCanvasItemUuids<T extends { uuid?: string }>(items: T[]) {
    return items.map((item) => ({ ...item, uuid: crypto.randomUUID() }));
}
