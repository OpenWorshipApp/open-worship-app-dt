import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkIsLocalHostname, checkIsPublicHost } from './webUrlPolicy.mjs';

// DNS is replaced so no test reaches the network, and so a test can tell
// whether a lookup was even attempted.
const dnsState = vi.hoisted(() => {
  return { lookupCalls: [], addressList: [] };
});

vi.mock('node:dns/promises', () => {
  const lookup = async (hostname, options) => {
    dnsState.lookupCalls.push([hostname, options]);
    return dnsState.addressList;
  };
  return { lookup, default: { lookup } };
});

beforeEach(() => {
  dnsState.lookupCalls = [];
  dnsState.addressList = [];
});

describe('an empty hostname', () => {
  // Nothing to judge is never "the public internet": an empty name, or one
  // that is only the root dot, is treated as this machine.
  test.each(['', '.', undefined, null])(
    'checkIsLocalHostname(%j) is local',
    (hostname) => {
      expect(checkIsLocalHostname(hostname)).toBe(true);
    },
  );

  test.each(['', '.'])(
    'checkIsPublicHost(%j) is refused without a DNS lookup',
    async (hostname) => {
      const verdict = await checkIsPublicHost(hostname);
      expect(verdict.isAllowed).toBe(false);
      expect(verdict.reason).toBe(
        `"${hostname}" is on this computer or its local network, not the ` +
          "public internet, so it cannot be read this way. This app's own " +
          'windows, settings and files live there. To find out what the app ' +
          'is doing, use owa_app_state, owa_list_screens or owa_list_ui.',
      );
      expect(dnsState.lookupCalls).toEqual([]);
    },
  );

  test('a real public name is still looked up, and allowed', async () => {
    dnsState.addressList = [{ address: '93.184.215.14', family: 4 }];
    expect(checkIsLocalHostname('example.com')).toBe(false);
    await expect(checkIsPublicHost('example.com')).resolves.toEqual({
      isAllowed: true,
    });
    expect(dnsState.lookupCalls).toEqual([['example.com', { all: true }]]);
  });
});
