export function normalizeBibleKey(bibleKey: string) {
    return bibleKey.trim().toLocaleLowerCase();
}

export function checkIsBibleKeyTaken(
    bibleKey: string,
    takenBibleKeys: Iterable<string>,
) {
    const normalizedBibleKey = normalizeBibleKey(bibleKey);
    if (normalizedBibleKey === '') {
        return false;
    }
    for (const takenBibleKey of takenBibleKeys) {
        if (normalizeBibleKey(takenBibleKey) === normalizedBibleKey) {
            return true;
        }
    }
    return false;
}
