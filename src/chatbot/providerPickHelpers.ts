/**
 * Where an arrow key on the CLOSED assistant list ends up when the row it
 * landed on has no key: the next row that can answer, further along in the same
 * direction -- the way a disabled row used to be stepped over -- or null when
 * there is none, and the list stays on the provider it had.
 *
 * The rows with no key are pickable on purpose (picking one opens Settings at
 * its key box), and an arrow on a closed list changes its value on every press
 * (Windows, Linux). Without this, moving through the list would open Settings,
 * and every row past a keyless one would be out of the keyboard's reach.
 */
export function findSteppedProvider<T extends string>(
    keys: readonly T[],
    availableKeys: readonly T[],
    landedKey: T,
    step: 1 | -1,
): T | null {
    const landedIndex = keys.indexOf(landedKey);
    if (landedIndex === -1) {
        return null;
    }
    for (
        let index = landedIndex + step;
        index >= 0 && index < keys.length;
        index += step
    ) {
        if (availableKeys.includes(keys[index])) {
            return keys[index];
        }
    }
    return null;
}
