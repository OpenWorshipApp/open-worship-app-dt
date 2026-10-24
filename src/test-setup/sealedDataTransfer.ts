/**
 * A `DataTransfer` that goes protected the way Chromium's does (2026-10-22).
 *
 * A browser lets `dragstart` write a drag's data and `drop` read it only
 * while the handler is RUNNING: once it returns, a write is ignored and a
 * read answers ''. A plain object or jsdom stand-in keeps answering after an
 * `await`, so a handler that awaits before `setData` or `getData` passes its
 * test and fails under a real mouse -- the Bible history row did exactly
 * that. Dispatch the event, call `seal()`, then let the handler's awaits run:
 * whatever it does after them is what the browser would have let it do.
 */
export function createSealedDataTransfer(
    initialData: Record<string, string> = {},
) {
    const toKey = (format: string) => {
        const lowered = String(format).toLowerCase();
        return lowered === 'text' ? 'text/plain' : lowered;
    };
    const store = new Map<string, string>();
    for (const [format, value] of Object.entries(initialData)) {
        store.set(toKey(format), value);
    }
    let isSealed = false;
    const dataTransfer = {
        dropEffect: 'none',
        effectAllowed: 'all',
        files: [] as File[],
        items: [] as DataTransferItem[],
        get types() {
            return isSealed ? [] : [...store.keys()];
        },
        setData(format: string, value: string) {
            if (!isSealed) {
                store.set(toKey(format), String(value));
            }
        },
        getData(format: string) {
            return isSealed ? '' : (store.get(toKey(format)) ?? '');
        },
        clearData(format?: string) {
            if (isSealed) {
                return;
            }
            if (format === undefined) {
                store.clear();
            } else {
                store.delete(toKey(format));
            }
        },
    };
    return {
        dataTransfer: dataTransfer as unknown as DataTransfer,
        /** The handler has returned: from now on it is protected. */
        seal() {
            isSealed = true;
        },
        /** What was written before the seal, for the test to read. */
        readData() {
            return Object.fromEntries(store);
        },
    };
}
