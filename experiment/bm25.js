function computeBM25(documents, query, k1 = 1.5, b = 0.75) {
    const N = documents.length; // Total number of documents
    const avgDocLength =
        documents.reduce((sum, doc) => sum + doc.split(' ').length, 0) / N;

    const termFrequencies = documents.map((doc) => {
        const tf = {};
        doc.split(' ').forEach((word) => {
            tf[word] = (tf[word] || 0) + 1;
        });
        return tf;
    });

    const documentFrequencies = {};
    documents.forEach((doc) => {
        const uniqueWords = new Set(doc.split(' '));
        uniqueWords.forEach((word) => {
            documentFrequencies[word] = (documentFrequencies[word] || 0) + 1;
        });
    });

    const scores = documents.map((doc, index) => {
        const docLength = doc.split(' ').length;
        let score = 0;
        query.split(' ').forEach((term) => {
            if (term in termFrequencies[index]) {
                const df = documentFrequencies[term] || 0;
                const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
                const tf = termFrequencies[index][term];
                score +=
                    idf *
                    ((tf * (k1 + 1)) /
                        (tf + k1 * (1 - b + b * (docLength / avgDocLength))));
            }
        });
        return score;
    });

    return scores;
}

// Example usage
function testBM25(documents, query, shouldJoin = false) {
    const scores = computeBM25(documents, query);
    const mappedDocuments = documents
        .map((doc, index) => [doc, scores[index]])
        .sort((a, b) => b[1] - a[1]);
    if (shouldJoin) {
        query = query.split(' ').join('');
        mappedDocuments.forEach((item) => {
            item[0] = item[0].split(' ').join('');
        });
    }

    console.log('Query', `"${query}"`, 'BM25 Scores:', mappedDocuments);
}

const documents = [
    'the quick brown fox',
    'jumps over the lazy dog',
    'the quick brown dog',
    'quick',
    'brown',
    'browm',
    'quick brown',
];
const query = 'quick brown';
testBM25(documents, query);

// Samples in other languages are each language's own data:
// `src/lang/data/<code>/experiment/bm25-samples.json`.
const fs = require('node:fs');
const path = require('node:path');

const langDataDir = path.join(__dirname, '..', 'src', 'lang', 'data');
for (const code of fs.readdirSync(langDataDir)) {
    const filePath = path.join(langDataDir, code, 'experiment', 'bm25-samples.json');
    if (!fs.existsSync(filePath)) {
        continue;
    }
    const { samples } = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const { documents: sampleDocuments, query: sampleQuery, isByLetter } of samples) {
        if (isByLetter) {
            testBM25(
                sampleDocuments.map((item) => item.split('').join(' ')),
                sampleQuery.split('').join(' '),
                true,
            );
        } else {
            testBM25(sampleDocuments, sampleQuery);
        }
    }
}
