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

/**
 * One row of the assistant list. Usually a provider; for the user's own
 * servers, ONE ROW PER SERVER under the name they gave it ("LM Studio"),
 * all of them standing for the one `custom` provider -- `serverId` says
 * which, and picking the row asks that server.
 */
export type AssistantRowType<T extends string> = {
    value: string;
    provider: T;
    serverId: string | null;
    label: string;
    isAvailable: boolean;
};

export function toCustomRowValue(customKey: string, serverId: string) {
    return `${customKey}/${serverId}`;
}

/**
 * The rows, in the providers' own order, the custom provider replaced by its
 * servers -- and by nothing at all when there is none to ask: a custom row
 * cannot "need a key" the way a provider's can, so it is never shown empty.
 */
export function genAssistantRows<T extends string>(
    providerList: readonly { key: T; label: string }[],
    availableProviders: readonly T[],
    customKey: T,
    customServers: readonly { id: string; name: string }[],
): AssistantRowType<T>[] {
    const rows: AssistantRowType<T>[] = [];
    for (const item of providerList) {
        if (item.key === customKey) {
            if (!availableProviders.includes(customKey)) {
                continue;
            }
            for (const server of customServers) {
                rows.push({
                    value: toCustomRowValue(customKey, server.id),
                    provider: item.key,
                    serverId: server.id,
                    label: server.name,
                    isAvailable: true,
                });
            }
            continue;
        }
        rows.push({
            value: item.key,
            provider: item.key,
            serverId: null,
            label: item.label,
            isAvailable: availableProviders.includes(item.key),
        });
    }
    return rows;
}

/**
 * The row a tab is on: its provider, or for the custom provider the server
 * its model belongs to (a custom model id is `<serverId>/<rowId>`).
 */
export function toAssistantRowValue<T extends string>(
    provider: T | null,
    model: string,
    customKey: T,
): string | null {
    if (provider === null) {
        return null;
    }
    if (provider === customKey) {
        return toCustomRowValue(customKey, model.split('/')[0]);
    }
    return provider;
}
