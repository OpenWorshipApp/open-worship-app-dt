// Pure, dependency-free: how suggestion words are filtered and ranked, shared
// by the SQLite find and the plain fallback find (`PlainFindHandler`).

export function rankSuggestionWords(words: string[], attemptingWord: string) {
    const needle = attemptingWord.toLowerCase();
    const rankOf = (word: string) => {
        const lowerWord = word.toLowerCase();
        if (lowerWord.startsWith(needle)) {
            return 0;
        }
        return lowerWord.includes(needle) ? 1 : 2;
    };
    return words
        .map((word, index) => ({ word, index, rank: rankOf(word) }))
        .sort((a, b) => {
            if (a.rank !== b.rank) {
                return a.rank - b.rank;
            }
            if (a.rank === 0 && a.word.length !== b.word.length) {
                return a.word.length - b.word.length;
            }
            return a.index - b.index;
        })
        .map(({ word }) => word);
}

export function finishSuggestionWords(
    found: { text: string; bookKeys: string }[],
    attemptingWord: string,
    limit: number,
    bookKeys: string[],
) {
    let result = found;
    if (bookKeys.length > 0) {
        result = result.filter(({ bookKeys: foundBookKeys }) => {
            const foundKeys = foundBookKeys.split(' ');
            return bookKeys.some((bookKey) => foundKeys.includes(bookKey));
        });
    }
    const mappedResult = rankSuggestionWords(
        result.map(({ text }) => text),
        attemptingWord,
    ).slice(0, limit);
    if (mappedResult.includes(attemptingWord)) {
        mappedResult.splice(mappedResult.indexOf(attemptingWord), 1);
        mappedResult.unshift(attemptingWord);
    }
    return mappedResult;
}
