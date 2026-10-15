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

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
  waitForNewAppPage: app.waitForNewAppPage,
}));
vi.mock('./discovery.mjs', () => ({
  readLiveInstances: app.readLiveInstances,
}));
vi.mock('./help.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  searchHelp: app.searchHelp,
  readHelpPage: app.readHelpPage,
}));
vi.mock('./questions.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  outlineQuestions: app.outlineQuestions,
  matchQuestions: app.matchQuestions,
}));

import { registerOwaTools } from './owaTools.mjs';

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
  it('offers the read and write handlers with their intended annotations', () => {
    expect(handlers.size).toBeGreaterThan(25);
    expect(
      handlers
        .get('owa_help_search')
        .schema.inputSchema.query.safeParse('verse').success,
    ).toBe(true);
    expect(
      handlers.get('owa_help_search').schema.inputSchema.limit.safeParse(21)
        .success,
    ).toBe(false);
    expect(
      handlers.get('owa_hide_screens').schema.annotations.destructiveHint,
    ).toBe(true);
    expect(
      handlers.get('owa_pick_element').schema.annotations.openWorldHint,
    ).toBe(true);
  });

  it('marks a manual search hit as an excerpt and leaves internal results alone', async () => {
    app.searchHelp.mockReturnValueOnce([
      { id: 'W-06', kind: 'manual', title: 'Bible' },
    ]);
    const manual = JSON.parse(
      answer(
        await call('owa_help_search', { query: 'verse', focus: 'presenter' }),
      ),
    );
    expect(manual[0].note).toContain('owa_help_page');
    expect(app.searchHelp).toHaveBeenCalledWith(
      'verse',
      5,
      'auto',
      'presenter',
      'en',
    );

    app.searchHelp.mockReturnValueOnce([
      { id: 'internal:note', kind: 'internal' },
    ]);
    const internal = JSON.parse(
      answer(await call('owa_help_search', { query: 'note' })),
    );
    expect(internal[0]).not.toHaveProperty('note');
    app.searchHelp.mockReturnValueOnce([]);
    expect(
      answer(await call('owa_help_search', { query: 'absent' })),
    ).toContain('Nothing in the manual');
  });

  it('returns a question outline or a compact ranked suggestion', async () => {
    app.outlineQuestions.mockReturnValue([{ section: 'screens' }]);
    expect(
      JSON.parse(
        answer(await call('owa_list_questions', { focus: 'presenter' })),
      ),
    ).toEqual([{ section: 'screens' }]);
    expect(app.outlineQuestions).toHaveBeenCalledWith({ focus: 'presenter' });

    app.matchQuestions.mockReturnValueOnce([
      {
        text: 'How do I show a verse?',
        kind: 'manual',
        section: 'Bible',
        panel: 'Lookup',
        resources: ['W-06'],
        keywords: ['hidden'],
        starterRank: 2,
      },
    ]);
    expect(
      JSON.parse(
        answer(await call('owa_list_questions', { query: 'verse', limit: 2 })),
      ),
    ).toEqual([
      {
        text: 'How do I show a verse?',
        kind: 'manual',
        section: 'Bible',
        panel: 'Lookup',
        resources: ['W-06'],
      },
    ]);
    expect(app.matchQuestions).toHaveBeenCalledWith('verse', {
      focus: null,
      page: null,
      section: null,
      limit: 2,
    });
    app.matchQuestions.mockReturnValueOnce([]);
    expect(
      answer(await call('owa_list_questions', { query: 'unknown' })),
    ).toContain('No prepared question');
  });

  it('explains an unknown translation and keeps English labels', async () => {
    const result = JSON.parse(
      answer(
        await call('owa_tran', {
          text: ['Clear Slide', 'Show'],
          lang: 'xx',
        }),
      ),
    );
    expect(result.note).toContain('no "xx" translation');
    expect(result.labels).toEqual([
      { english: 'Clear Slide', onScreen: 'Clear Slide' },
      { english: 'Show', onScreen: 'Show' },
    ]);
    expect(result.languages).toContain('en');
  });

  it('returns a page without its recipe heading and rejects a missing page', async () => {
    app.readHelpPage.mockReturnValueOnce({
      kind: 'manual',
      title: 'Present a Bible Verse',
      body: '# W-06 — Present a Bible Verse\n\nPress Lookup to find John 3:16.',
      part: 1,
      partCount: 1,
    });
    const page = answer(await call('owa_help_page', { id: 'W-06' }));
    expect(page).toContain('# Present a Bible Verse');
    expect(page).toContain('Press Lookup to find John 3:16.');
    expect(page).not.toContain('# W-06');
    expect(app.readHelpPage).toHaveBeenCalledWith('W-06', 'en', 1);

    app.readHelpPage.mockReturnValueOnce(null);
    const missing = await call('owa_help_page', { id: 'bad' });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('No knowledge document');
  });

  it('keeps private instance paths out of app state', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: { page: 'reader.html', lang: 'en' },
    });
    app.listTargets.mockResolvedValue([
      { title: 'Reader', url: 'http://localhost:9222/reader.html' },
    ]);
    app.readLiveInstances.mockReturnValue([
      {
        pid: 19,
        port: 9222,
        isDev: true,
        version: '1.2.3',
        startedAt: 5,
        dataDir: 'C:/Users/private',
        mcpUrl: 'http://localhost/private',
      },
    ]);
    const result = JSON.parse(answer(await call('owa_app_state')));
    expect(result.instances).toEqual([
      {
        pid: 19,
        port: 9222,
        isDev: true,
        version: '1.2.3',
        startedAt: 5,
      },
    ]);
    expect(result.windows).toEqual([
      { title: 'Reader', url: 'http://localhost:9222/reader.html' },
    ]);
    expect(result.mainWindow.page).toBe('reader.html');
    expect(JSON.stringify(result)).not.toContain('C:/Users/private');
  });

  it('aims screen reads and Bible actions at the presenter when it is open', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
    ]);
    app.evaluateInApp.mockResolvedValueOnce({
      value: { isAnyShowing: false, screens: [] },
    });
    expect(JSON.parse(answer(await call('owa_list_screens')))).toEqual({
      isAnyShowing: false,
      screens: [],
    });
    expect(app.evaluateInApp.mock.calls[0][1]).toEqual({
      port: 9222,
      match: 'presenter.html',
    });

    app.evaluateInApp.mockResolvedValueOnce({
      value: {
        reference: 'John 3:16',
        version: 'KJV',
        isPresented: false,
      },
    });
    expect(
      JSON.parse(
        answer(
          await call('owa_present_bible', {
            reference: 'John 3:16',
            action: 'check',
          }),
        ),
      ).reference,
    ).toBe('John 3:16');
    expect(app.evaluateInApp.mock.calls[1][1]).toEqual({
      port: 9222,
      match: 'presenter.html',
    });
    expect(app.evaluateInApp.mock.calls[1][0]).toContain('John 3:16');

    app.evaluateInApp.mockResolvedValueOnce({
      value: { isError: true, reason: 'Not installed' },
    });
    const failed = await call('owa_present_bible', { reference: 'John 3:16' });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toContain('Not installed');
  });

  it('returns screenshot image blocks and a useful error for a missing image', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: 'data:image/png;base64,aGVsbG8=',
    });
    const screenshot = await call('owa_screenshot', { screenId: 2 });
    expect(screenshot.content[1]).toEqual({
      type: 'image',
      mimeType: 'image/png',
      data: 'aGVsbG8=',
    });
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('screenId: 2');

    app.evaluateInApp.mockResolvedValueOnce({ value: 'not a picture' });
    const missing = await call('owa_screenshot', {});
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('did not return a picture');
  });

  it('returns website text with the image when available and text alone otherwise', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: {
        url: 'https://example.org/',
        title: 'Example',
        text: 'Useful source text',
        imageDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
      },
    });
    const withImage = await call('owa_read_website', {
      url: 'https://example.org/',
      screenshot: true,
    });
    expect(withImage.content[0].text).toContain('Useful source text');
    expect(withImage.content[1]).toEqual({
      type: 'image',
      mimeType: 'image/jpeg',
      data: 'aGVsbG8=',
    });

    app.evaluateInApp.mockResolvedValueOnce({
      value: {
        url: 'https://example.org/',
        text: 'Text still available',
        imageDataUrl: null,
      },
    });
    const textOnly = await call('owa_read_website', {
      url: 'https://example.org/',
      screenshot: true,
    });
    expect(textOnly.isError).not.toBe(true);
    expect(textOnly.content).toHaveLength(1);
    expect(textOnly.content[0].text).toContain('Text still available');
  });

  it('rejects invalid song and file requests before contacting the app', async () => {
    const empty = await call('owa_lyric_validate', {});
    expect(empty.isError).toBe(true);
    expect(empty.content[0].text).toContain('Nothing to work on');
    const noTitle = await call('owa_lyric_validate', { mode: 'find' });
    expect(noTitle.isError).toBe(true);
    expect(noTitle.content[0].text).toContain('title');
    const badName = await call('owa_slide_file', {
      action: 'create',
      name: '../private',
      content: '{}',
    });
    expect(badName.isError).toBe(true);
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('checks song notation before a write and reports line guidance', async () => {
    const invalid = await call('owa_lyric_file', {
      action: 'create',
      name: 'Sunday',
      content: 'not Open Lyric notation',
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.content[0].text).toContain('nothing was written');
    expect(invalid.content[0].text).toContain('line');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('forwards valid data requests and propagates app refusals', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: { items: ['John 3:16'] },
    });
    const listed = JSON.parse(
      answer(await call('owa_bible_item', { action: 'list' })),
    );
    expect(listed.items).toEqual(['John 3:16']);
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('bible-item');

    app.evaluateInApp.mockResolvedValueOnce({
      value: { isError: true, reason: 'List does not exist' },
    });
    const failed = await call('owa_bible_item', {
      action: 'add',
      list: 'Missing',
      reference: 'John 3:16',
    });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toContain('List does not exist');
  });

  it('refuses to overwrite notes while their editing window is open', async () => {
    app.listTargets.mockResolvedValue([
      {
        url: 'http://localhost/bibleNote.html?file=Sunday.own',
      },
    ]);
    const refused = await call('owa_bible_note', {
      action: 'add',
      file: 'Sunday',
      title: 'Prayer',
      text: 'Remember',
    });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('open in a note window');
    expect(app.evaluateInApp).not.toHaveBeenCalled();

    app.evaluateInApp.mockResolvedValueOnce({ value: { notes: [] } });
    expect(
      JSON.parse(
        answer(
          await call('owa_bible_note', { action: 'list', file: 'Sunday' }),
        ),
      ),
    ).toEqual({ notes: [] });
  });

  it('requires a label before clicking or typing, and refuses an invalid shortcut', async () => {
    for (const [name, args] of [
      ['owa_click', { find: '' }],
      ['owa_type', { find: [], value: 'John 3:16' }],
      ['owa_drag', { from: '', to: 'Slides' }],
      ['owa_press_key', { keys: 'not a shortcut' }],
    ]) {
      const result = await call(name, args);
      expect(result.isError, name).toBe(true);
    }
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('reports UI matches from open app windows and skips a closing window', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/chatbot.html' },
      { url: 'http://localhost/reader.html' },
    ]);
    app.evaluateInTarget.mockResolvedValueOnce({
      matches: [{ text: 'Clear Slide' }],
      nearMisses: [],
    });
    app.evaluateInTarget.mockRejectedValueOnce(new Error('closed'));
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Clear Slide', anyPage: true })),
    );
    expect(found.count).toBe(1);
    expect(found.matches).toEqual([
      { text: 'Clear Slide', page: 'presenter.html' },
    ]);
    expect(app.evaluateInTarget).toHaveBeenCalledTimes(2);
  });

  it('returns local UI reads and guarded click results', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: { matches: [{ text: 'Lookup' }] },
    });
    expect(
      JSON.parse(answer(await call('owa_find_ui', { text: 'Lookup' }))).matches,
    ).toHaveLength(1);
    app.evaluateInApp.mockResolvedValueOnce({
      value: { controls: [{ text: 'Lookup' }] },
    });
    expect(
      JSON.parse(answer(await call('owa_list_ui', { filter: 'Lookup' })))
        .controls,
    ).toHaveLength(1);
    app.evaluateInApp.mockResolvedValueOnce({
      value: { clicked: true, opened: 'panel', didChange: true },
    });
    const clicked = JSON.parse(
      answer(await call('owa_click', { find: 'Lookup' })),
    );
    expect(clicked).toMatchObject({ opened: 'panel', didChange: true });
  });

  it('handles navigation already on the requested page and a completed switch', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: { switching: false, page: 'reader.html' },
    });
    expect(
      JSON.parse(answer(await call('owa_goto_page', { page: 'reader.html' }))),
    ).toEqual({
      page: 'reader.html',
      switched: false,
    });

    app.evaluateInApp.mockResolvedValueOnce({
      value: { switching: true, from: 'reader.html' },
    });
    app.listTargets.mockResolvedValueOnce([
      { url: 'http://localhost/presenter.html' },
    ]);
    expect(
      JSON.parse(
        answer(await call('owa_goto_page', { page: 'presenter.html' })),
      ),
    ).toEqual({
      page: 'presenter.html',
      switched: true,
      from: 'reader.html',
    });
  });

  it('rejects contradictory guides and moves an existing guide', async () => {
    const contradictory = await call('owa_guide_start', {
      demoId: 'first',
      steps: [{ text: 'Press Lookup' }],
    });
    expect(contradictory.isError).toBe(true);
    expect(contradictory.content[0].text).toContain('demoId by itself');
    expect(app.evaluateInApp).not.toHaveBeenCalled();

    app.evaluateInApp.mockResolvedValueOnce({ value: { currentStep: 2 } });
    expect(
      JSON.parse(
        answer(await call('owa_guide_step', { action: 'goto', stepNumber: 3 })),
      ),
    ).toEqual({ currentStep: 2 });
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('go(2)');
  });

  it('passes typed values and drag positions to the app', async () => {
    app.evaluateInApp.mockResolvedValueOnce({
      value: { changed: true, value: 'John 3:16' },
    });
    expect(
      JSON.parse(
        answer(
          await call('owa_type', {
            find: 'Bible reference',
            value: 'John 3:16',
            submit: true,
          }),
        ),
      ).changed,
    ).toBe(true);
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('John 3:16');

    app.evaluateInApp.mockResolvedValueOnce({ value: { accepted: true } });
    expect(
      JSON.parse(
        answer(
          await call('owa_drag', {
            from: 'Verse slide',
            to: 'Closing slide',
            place: 'before',
          }),
        ),
      ).accepted,
    ).toBe(true);
    expect(app.evaluateInApp.mock.calls[1][0]).toContain('before');
  });

  it('passes a single key and scroll request through the guarded UI tools', async () => {
    app.evaluateInApp.mockResolvedValueOnce({ value: { didChange: true } });
    expect(
      JSON.parse(answer(await call('owa_press_key', { keys: '1' }))).didChange,
    ).toBe(true);
    expect(app.evaluateInApp.mock.calls[0][0]).toContain('Digit1');

    app.evaluateInApp.mockResolvedValueOnce({
      value: { isAtBottom: true, inView: ['Last song'] },
    });
    expect(
      JSON.parse(
        answer(await call('owa_scroll', { to: 'bottom', find: 'Documents' })),
      ).inView,
    ).toEqual(['Last song']);
    expect(app.evaluateInApp.mock.calls[1][0]).toContain('bottom');
  });

  it('rejects an unlabelled menu click and reports menu entries', async () => {
    const missing = await call('owa_menu', { action: 'click' });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('Name the menu item');
    expect(app.evaluateInApp).not.toHaveBeenCalled();

    app.evaluateInApp.mockResolvedValueOnce({
      value: [{ path: 'View > Reload', isEnabled: true }],
    });
    const menu = JSON.parse(answer(await call('owa_menu', { action: 'list' })));
    expect(menu.items).toEqual([{ path: 'View > Reload', isEnabled: true }]);
  });

  it('starts a custom guide with the requested steps and reports its status', async () => {
    app.evaluateInApp.mockResolvedValueOnce({ value: '/presenter.html' });
    app.evaluateInApp.mockResolvedValueOnce({
      value: { currentStep: 1, isTargetFound: true },
    });
    const started = JSON.parse(
      answer(
        await call('owa_guide_start', {
          title: 'Present a verse',
          steps: [{ text: 'Open Lookup', find: 'Lookup' }],
          page: 'presenter.html',
        }),
      ),
    );
    expect(started.currentStep).toBe(1);
    expect(app.evaluateInApp.mock.calls[1][0]).toContain('Open Lookup');
    expect(app.evaluateInApp.mock.calls[1][1]).toEqual({
      match: 'presenter.html',
    });

    app.evaluateInApp.mockResolvedValueOnce({
      value: { currentStep: 1, text: 'Open Lookup' },
    });
    expect(
      JSON.parse(
        answer(await call('owa_guide_status', { page: 'presenter.html' })),
      ).text,
    ).toBe('Open Lookup');
  });
});
