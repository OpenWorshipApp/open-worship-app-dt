// The Khmer cases of `tools/owa-devtools-mcp/owaTools.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  waitForNewAppPage: vi.fn(),
  readLiveInstances: vi.fn(),
  searchHelp: vi.fn(),
  readHelpPage: vi.fn(),
  outlineQuestions: vi.fn(),
  matchQuestions: vi.fn(),
}));

vi.mock('../../../../../../../../tools/owa-devtools-mcp/cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
  waitForNewAppPage: app.waitForNewAppPage,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/discovery.mjs', () => ({
  readLiveInstances: app.readLiveInstances,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/help.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  searchHelp: app.searchHelp,
  readHelpPage: app.readHelpPage,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/questions.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  outlineQuestions: app.outlineQuestions,
  matchQuestions: app.matchQuestions,
}));

import { registerOwaTools } from '../../../../../../../../tools/owa-devtools-mcp/owaTools.mjs';

const handlers = new Map();
registerOwaTools({
  registerTool(name, schema, handler) {
    handlers.set(name, { schema, handler });
  },
});

function call(name, args = {}) {
  return handlers.get(name).handler(args);
}

function answer(result) {
  expect(result.isError).not.toBe(true);
  return result.content[0].text;
}

beforeEach(() => {
  vi.resetAllMocks();
  app.evaluateInApp.mockResolvedValue({ value: 'en' });
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
  app.readLiveInstances.mockReturnValue([]);
});

describe('registered app tools', () => {

  // T2 (robot run 2026-10-16): a scope now matches the name a panel SHOWS,
  // which is in the window's language, so each half of "Panel > Control" is
  // offered translated -- the whole string was no dictionary key.
  it('offers a scoped label with each half translated', async () => {
    app.evaluateInApp
      .mockResolvedValueOnce({ value: 'km' })
      .mockResolvedValueOnce({
        value: { clicked: true, didChange: true },
      });
    answer(
      await call('owa_click', {
        find: 'Documents > More Options',
        page: 'km-scope.html',
      }),
    );
    const [expression] = app.evaluateInApp.mock.calls[1];
    expect(expression).toContain('"Documents > More Options"');
    expect(expression).toContain('"ឯកសារ > ជម្រើសបន្ថែម"');
    // The language read is cached for ONE page; hand the cache back to the
    // default page the later cases are written against.
    app.evaluateInApp
      .mockResolvedValueOnce({ value: 'en' })
      .mockResolvedValueOnce({ value: { clicked: true, didChange: true } });
    answer(await call('owa_click', { find: 'More Options' }));
  });
});
