/**
 * Screen Show's one rule: a screen never shows itself, and no screen shows one
 * whose picture already holds it. Either would be a picture of a picture of
 * itself -- repainted for ever, on every projector in the chain.
 *
 * `edges` maps a screen to the screens it shows. `targetScreenIds` are every
 * screen about to show `sourceScreenId`: the chosen screen AND its colour-note
 * group, since a foreground change is copied to the whole group.
 *
 * Pure, so it can be tested without a single screen manager.
 */
export function findScreenShowRefusal(
    sourceScreenId: number,
    targetScreenIds: number[],
    edges: Map<number, number[]>,
): 'self' | 'loop' | null {
    if (targetScreenIds.includes(sourceScreenId)) {
        return 'self';
    }
    const seen = new Set<number>();
    const stack = [sourceScreenId];
    while (stack.length > 0) {
        const screenId = stack.pop()!;
        if (seen.has(screenId)) {
            continue;
        }
        seen.add(screenId);
        for (const shownScreenId of edges.get(screenId) ?? []) {
            if (targetScreenIds.includes(shownScreenId)) {
                return 'loop';
            }
            stack.push(shownScreenId);
        }
    }
    return null;
}

// A screen id a Screen Show may name: a stored row or a message carries
// anything, and only a plain non-negative integer is a screen.
export function checkIsScreenShowSourceId(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
