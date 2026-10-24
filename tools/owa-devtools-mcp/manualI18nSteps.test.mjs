import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { lineUpTranslatedSteps, toGuideSteps } from './guide.mjs';
import {
  listEnglishManualPages,
  listManualLanguages,
  listManualTranslations,
  MANUAL_SOURCE_DIR,
} from './manualI18n.mjs';
import { toManualPageBody } from './manualPage.mjs';

// The walkthrough card reads a recipe's steps off the ENGLISH page and their
// words off the page's translation (`withLocalStepText` in `owaTools.mjs`):
// a translation whose steps do not line up shows its card in English
// sentences round translated button names. Every current translation is
// held to lining up -- 61 of 64 Khmer pages did on the day this was written,
// and the other three were made to (2026-10-17).
describe('a translated manual page lines up with its English steps', () => {
  const englishPageMap = listEnglishManualPages();
  for (const langCode of listManualLanguages()) {
    it(langCode, () => {
      const missed = [];
      for (const page of listManualTranslations(langCode, { englishPageMap })) {
        const english = englishPageMap.get(page.id);
        if (page.isStale || english === undefined) {
          continue;
        }
        const englishBody = toManualPageBody(
          readFileSync(
            path.join(MANUAL_SOURCE_DIR, english.relativePath),
            'utf-8',
          ),
        );
        const count = toGuideSteps(englishBody).length;
        const lined = lineUpTranslatedSteps(
          englishBody,
          toManualPageBody(page.content),
          count,
        );
        if (lined === null) {
          missed.push(page.id);
        }
      }
      expect(missed).toEqual([]);
    });
  }
});
