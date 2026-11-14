// The French cases of `tools/owa-devtools-mcp/questions.test.mjs`, kept with
// the language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, it } from 'vitest';

import {
  flattenQuestions,
  loadQuestionOverlays,
  loadQuestionPages,
} from '../../../../../../../../tools/owa-devtools-mcp/questions.mjs';
import {
  applyQuestionOverlay,
  toEnglishTemplateAsk,
} from '../../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs';

describe('the corpus in French', () => {
  // A fill-in row finished in French is asked as its English, the part the
  // person wrote kept as they wrote it.
  it('reads a finished fill-in row back into its English', () => {
    const rows = flattenQuestions(
      applyQuestionOverlay(
        loadQuestionPages(),
        loadQuestionOverlays().find((one) => {
          return one.lang === 'fr';
        }),
      ),
    );
    expect(
      rows.find((row) => {
        return row.id === 'settings.bible-settings.import-bible-language';
      })?.text,
    ).toBe('Importer une Bible dans "votre langue"');
    expect(
      toEnglishTemplateAsk('Importer une Bible dans "espagnol"', rows),
    ).toBe('Import a Bible in "espagnol"');
    expect(toEnglishTemplateAsk('Bonjour', rows)).toBeNull();
  });
});
