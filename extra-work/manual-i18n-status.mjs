'use strict';
/* eslint-disable */
// Which manual pages are translated into each of the app's other languages,
// which are missing, and which are STALE -- the English page changed after the
// translation was made, so the help shows the English page for it until it is
// translated again (`tools/owa-devtools-mcp/manualI18n.mjs`).
//
//   node extra-work/manual-i18n-status.mjs            every language
//   node extra-work/manual-i18n-status.mjs km         one language
//   node extra-work/manual-i18n-status.mjs --hash <docs/manual-sources/…md>
//       the `translatedFrom` a translation of that page must carry
//
// Never a failing gate: a manual edit must not be blocked by a translation.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    MANUAL_SOURCE_DIR,
    hashManualPage,
    listEnglishManualPages,
    listManualLanguages,
    listManualTranslations,
    readFrontMatter,
} from '../tools/owa-devtools-mcp/manualI18n.mjs';
import { toManualPageBody } from '../tools/owa-devtools-mcp/manualPage.mjs';
import { toPassages } from '../tools/owa-devtools-mcp/passageMatch.mjs';
import { readSourceAssistantFacts } from '../tools/owa-devtools-mcp/tran.mjs';

const args = process.argv.slice(2);
if (args[0] === '--hash') {
    console.log(hashManualPage(readFileSync(args[1], 'utf-8')));
    process.exit(0);
}

// `--check <code> [W-06 …]`: what makes a translation one the help can use.
// The same passages as its English page, in the same order (the guide quotes
// the passage at the same place -- `genTranslatedExcerpt`), every button
// name kept as its `[en:tran:…]` template, the hash of the English it was
// made from, and the language's own letters in it.
if (args[0] === '--check') {
    const langCode = args[1];
    const onlyIdSet = new Set(args.slice(2));
    const englishPageMap = listEnglishManualPages();
    let problemCount = 0;
    for (const page of listManualTranslations(langCode, { englishPageMap })) {
        if (onlyIdSet.size > 0 && !onlyIdSet.has(page.id)) {
            continue;
        }
        const english = englishPageMap.get(page.id);
        const problems = [];
        if (english === undefined) {
            problems.push('no English page has this id');
        } else {
            const englishContent = readFileSync(
                join(MANUAL_SOURCE_DIR, english.relativePath),
                'utf-8',
            );
            const englishBody = toManualPageBody(englishContent);
            const body = toManualPageBody(page.content);
            if (page.isStale) {
                problems.push(
                    `translatedFrom is ${page.translatedFrom}, the English is ${english.hash}`,
                );
            }
            const englishPassages = toPassages(englishBody);
            const passages = toPassages(body);
            if (englishPassages.length !== passages.length) {
                problems.push(
                    `${passages.length} passages, the English has ${englishPassages.length}`,
                );
                const firstDifferent = englishPassages.findIndex((one, index) => {
                    const theirs = passages[index];
                    return (
                        theirs === undefined ||
                        /^\s*(\d+[a-z]?[.)])/.exec(one.text)?.[1] !==
                            /^\s*(\d+[a-z]?[.)])/.exec(theirs.text)?.[1]
                    );
                });
                if (firstDifferent !== -1) {
                    problems.push(
                        `first difference near passage ${firstDifferent + 1}: ` +
                            JSON.stringify(englishPassages[firstDifferent]?.text.slice(0, 80)),
                    );
                }
            }
            const toKeys = (text) => {
                return [...text.matchAll(/\[en:tran:([^\]]+)\]/g)]
                    .map((match) => match[1])
                    .sort();
            };
            const missingKeys = toKeys(englishBody).filter((key) => {
                return !toKeys(body).includes(key);
            });
            if (missingKeys.length > 0) {
                problems.push(`templates missing: ${[...new Set(missingKeys)].join(', ')}`);
            }
        }
        const facts = readSourceAssistantFacts(langCode);
        if (facts?.scriptPattern && !new RegExp(facts.scriptPattern, 'u').test(page.content)) {
            problems.push(`no ${facts.name} letters in it`);
        }
        // A language written in Latin letters cannot be told from English by
        // its letters: by its little words instead, the ones its
        // `assistant.json` lists against English's. A page left in English
        // passed the letter test whole.
        if (
            langCode !== 'en' &&
            facts?.scriptPattern &&
            new RegExp(facts.scriptPattern, 'u').test('a')
        ) {
            const words =
                page.content
                    .replace(/\[en:tran:[^\]]+\]/g, ' ')
                    .replace(/`[^`]*`/g, ' ')
                    .toLowerCase()
                    .match(/\p{L}+/gu) ?? [];
            const countOf = (list) => {
                const wordSet = new Set(
                    (list ?? []).map((word) => {
                        return word.toLowerCase();
                    }),
                );
                return words.filter((word) => {
                    return wordSet.has(word);
                }).length;
            };
            const ownCount = countOf(facts.functionWords);
            const englishCount = countOf(readSourceAssistantFacts('en')?.functionWords);
            if (ownCount <= englishCount) {
                problems.push(
                    `reads as English: ${ownCount} ${facts.name} little words, ` +
                        `${englishCount} English`,
                );
            }
        }
        if (readFrontMatter(page.content).lang !== langCode) {
            problems.push(`front matter lang is not ${langCode}`);
        }
        if (problems.length > 0) {
            problemCount += 1;
            console.log(`✗ ${page.id} ${page.relativePath}`);
            for (const problem of problems) {
                console.log(`    ${problem}`);
            }
        } else {
            console.log(`✓ ${page.id}`);
        }
    }
    process.exit(problemCount > 0 ? 1 : 0);
}

const englishPageMap = listEnglishManualPages();
const langCodeList = args.length > 0 ? args : listManualLanguages();
for (const langCode of langCodeList) {
    const pages = listManualTranslations(langCode, { englishPageMap });
    const translatedIdSet = new Set(pages.map((page) => page.id));
    const missing = [...englishPageMap.values()].filter((page) => {
        return !translatedIdSet.has(page.id);
    });
    const stale = pages.filter((page) => page.isStale);
    console.log(
        `${langCode}: ${pages.length - stale.length} of ${englishPageMap.size} ` +
            `pages current, ${stale.length} stale, ${missing.length} missing`,
    );
    for (const page of stale) {
        console.log(`  stale    ${page.id}  ${page.relativePath}`);
    }
    for (const page of missing) {
        console.log(`  missing  ${page.id}  ${page.relativePath}`);
    }
}
