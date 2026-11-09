// `findDrivenInstance`: the published instance `resolveAppBrowserUrl`
// drives -- the stdio bin reads the installed language folders off it. It
// must name the SAME app the address does: the port named on purpose (the
// host's pin, then `OWA_CDP_PORT`), else the newest of the kind asked for.
// The published files are a fake (`node:fs` mocked).

import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  findDrivenInstance,
  pinCdpPort,
  resolveAppBrowserUrl,
} from './discovery.mjs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const dev = {
  port: 60401,
  isDev: true,
  startedAt: '2026-10-07T00:29:00Z',
  langDirs: ['C:\\dev\\lang'],
};
const prod = {
  port: 60377,
  isDev: false,
  startedAt: '2026-10-07T00:30:00Z',
  langDirs: ['C:\\prod\\lang'],
};
const unknown = { port: 60555, startedAt: '2026-10-07T00:31:00Z' };

function publish(instances) {
  vi.mocked(readdirSync).mockReturnValue(instances.map((_, i) => `${i}.json`));
  vi.mocked(readFileSync).mockImplementation((filePath) => {
    const index = Number(String(filePath).match(/(\d+)\.json$/)[1]);
    return JSON.stringify(instances[index]);
  });
}

function toUrl(instance) {
  return `http://127.0.0.1:${instance.port}`;
}

beforeEach(() => {
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
  publish([dev, prod, unknown]);
});

afterEach(() => {
  pinCdpPort(null);
  vi.unstubAllEnvs();
});

describe('findDrivenInstance', () => {
  test('with nothing named it is the newest published instance, as the address is', () => {
    expect(findDrivenInstance()).toEqual(unknown);
    expect(resolveAppBrowserUrl()).toBe(toUrl(unknown));
    // Given the instances, it reads no file.
    vi.mocked(readdirSync).mockClear();
    expect(findDrivenInstance([prod, dev])).toEqual(prod);
    expect(readdirSync).not.toHaveBeenCalled();
    expect(findDrivenInstance([])).toBeNull();
  });

  test('a kind asked for is the newest of that kind, never the other', () => {
    vi.stubEnv('OWA_CDP_TARGET', 'dev');
    expect(findDrivenInstance()).toEqual(dev);
    expect(findDrivenInstance()?.langDirs).toEqual(['C:\\dev\\lang']);
    expect(resolveAppBrowserUrl()).toBe(toUrl(dev));
    vi.stubEnv('OWA_CDP_TARGET', 'prod');
    expect(findDrivenInstance()).toEqual(prod);
    // No instance of that kind is none, not the other kind.
    expect(findDrivenInstance([dev, unknown])).toBeNull();
    vi.stubEnv('OWA_CDP_TARGET', 'staging');
    expect(() => findDrivenInstance()).toThrow(
      'OWA_CDP_TARGET must be dev or prod',
    );
  });

  test('OWA_CDP_PORT names the instance on that port, whatever kind is asked for', () => {
    vi.stubEnv('OWA_CDP_PORT', String(prod.port));
    vi.stubEnv('OWA_CDP_TARGET', 'dev');
    expect(findDrivenInstance()).toEqual(prod);
    expect(resolveAppBrowserUrl()).toBe(toUrl(prod));
    // A port nobody published is no instance: the pin is that port or
    // nothing.
    vi.stubEnv('OWA_CDP_PORT', '9999');
    expect(findDrivenInstance()).toBeNull();
    expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:9999');
  });

  test("the host's own pin wins over OWA_CDP_PORT", () => {
    vi.stubEnv('OWA_CDP_PORT', String(prod.port));
    pinCdpPort(() => dev.port);
    expect(findDrivenInstance()).toEqual(dev);
    expect(resolveAppBrowserUrl()).toBe(toUrl(dev));
    // A pin whose port is not known yet leaves the env port in charge.
    pinCdpPort(() => null);
    expect(findDrivenInstance()).toEqual(prod);
  });
});
