import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

// Every name a module of this package uses is one it declared, imported, or
// one the runtime hands every module. `owa_help_page` answered
// "genFreshPageUrl is not defined" for every page on 2026-10-11: the call was
// added and the import was not. `node --check` passes that, nothing lints this
// folder (`lint:es` is `src` and `electron`), a server already running keeps
// its cached modules, and the one caller in the app falls back in silence when
// the page cannot be read -- so it took a reader calling the handler in a
// fresh process to see it.
const HERE = path.dirname(fileURLToPath(import.meta.url));

const RUNTIME_GLOBAL_LIST = [
  'AbortSignal',
  'Buffer',
  'URL',
  'WebSocket',
  'clearInterval',
  'clearTimeout',
  'console',
  'crypto',
  'fetch',
  'process',
  'setInterval',
  'setTimeout',
  // Used by a function that is handed to a page as source text and run there.
  'document',
  'location',
];

describe('the MCP modules', () => {
  test('use no name they neither declare nor import', async () => {
    const eslint = new ESLint({
      cwd: HERE,
      // This package's own rule and nothing else: the repo's config is for
      // the TypeScript sources.
      overrideConfigFile: true,
      overrideConfig: [
        // The modules the server runs; a test may name what vitest gives it.
        { ignores: ['**/*.test.mjs'] },
        {
          files: ['**/*.mjs'],
          linterOptions: { reportUnusedDisableDirectives: 'off' },
          languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: Object.fromEntries(
              RUNTIME_GLOBAL_LIST.map((name) => [name, 'readonly']),
            ),
          },
          rules: { 'no-undef': 'error' },
        },
      ],
    });
    const resultList = await eslint.lintFiles(['*.mjs']);
    const undeclaredList = resultList.flatMap((result) => {
      return result.messages
        .filter((message) => message.ruleId === 'no-undef' || message.fatal)
        .map((message) => {
          return `${path.basename(result.filePath)}:${message.line}  ${message.message}`;
        });
    });
    expect(undeclaredList).toEqual([]);
  }, 30000);
});
