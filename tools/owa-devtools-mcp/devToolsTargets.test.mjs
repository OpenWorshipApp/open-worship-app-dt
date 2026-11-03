import { describe, expect, it, vi } from 'vitest';

import { checkIsDevToolsUrl, skipDevToolsTargets } from './devToolsTargets.mjs';

// A DevTools window is never a page to the browser tools: on Chromium 128 it
// never answers an outside client (every page tool hung while it was open),
// and its console reaches Node.
const DEVTOOLS_URL = 'devtools://devtools/bundled/devtools_app.html';
const APP_URL = 'https://localhost:3000/reader.html';

function genTarget(url) {
  return { url: () => url };
}

function genPuppeteer() {
  const puppeteer = {};
  const connect = vi.fn(function (options) {
    return { self: this, options };
  });
  puppeteer.connect = connect;
  return { puppeteer, connect };
}

describe('checkIsDevToolsUrl', () => {
  it('tells a DevTools window from the app and from anything else', () => {
    expect(checkIsDevToolsUrl(DEVTOOLS_URL)).toBe(true);
    expect(checkIsDevToolsUrl(APP_URL)).toBe(false);
    expect(checkIsDevToolsUrl('chrome://inspect/#devices')).toBe(false);
    expect(checkIsDevToolsUrl(undefined)).toBe(false);
    expect(checkIsDevToolsUrl(null)).toBe(false);
  });
});

describe('skipDevToolsTargets', () => {
  it('drops DevTools pages on top of the filter chrome-devtools-mcp passes', () => {
    const { puppeteer, connect } = genPuppeteer();
    skipDevToolsTargets(puppeteer);
    const ownFilter = (target) => !target.url().startsWith('chrome://');
    const { options } = puppeteer.connect({
      browserURL: 'http://127.0.0.1:49730',
      handleDevToolsAsPage: true,
      defaultViewport: null,
      targetFilter: ownFilter,
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(options.targetFilter(genTarget(DEVTOOLS_URL))).toBe(false);
    expect(options.targetFilter(genTarget(APP_URL))).toBe(true);
    // Its own rule still holds.
    expect(options.targetFilter(genTarget('chrome://newtab/'))).toBe(false);
    // Nothing else it asked for is changed.
    expect(options).toMatchObject({
      browserURL: 'http://127.0.0.1:49730',
      handleDevToolsAsPage: true,
      defaultViewport: null,
    });
  });

  it('filters even when no target filter was given, and keeps `this`', () => {
    const { puppeteer } = genPuppeteer();
    skipDevToolsTargets(puppeteer);
    const { self, options } = puppeteer.connect();
    expect(self).toBe(puppeteer);
    expect(options.targetFilter(genTarget(DEVTOOLS_URL))).toBe(false);
    expect(options.targetFilter(genTarget(APP_URL))).toBe(true);
  });

  it('wraps once however many servers are made', () => {
    const { puppeteer, connect } = genPuppeteer();
    skipDevToolsTargets(puppeteer);
    const wrapped = puppeteer.connect;
    skipDevToolsTargets(puppeteer);
    expect(puppeteer.connect).toBe(wrapped);
    const ownFilter = vi.fn(() => true);
    const { options } = puppeteer.connect({ targetFilter: ownFilter });
    options.targetFilter(genTarget(APP_URL));
    expect(ownFilter).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
