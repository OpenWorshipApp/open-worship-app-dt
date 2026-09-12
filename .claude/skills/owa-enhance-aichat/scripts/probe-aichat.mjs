// Re-proves the AI Chat window's box from INSIDE the guest, against the
// RUNNING app.
//
//   node .claude/skills/owa-enhance-aichat/scripts/probe-aichat.mjs
//   node .../probe-aichat.mjs --json
//
// The AI Chat window must be open on at least one site. A `<webview>` guest
// is not a page chrome-devtools-mcp lists, so this reaches it the other way:
// the app's CDP `/json/list` names every target including the `webview`
// ones, and `evaluateInTarget` (tools/owa-devtools-mcp/cdp.mjs) speaks to
// one over its own socket.
//
// What it does to the app: reads, plus the two refusals it EXPECTS to be
// refused -- a `window.open` and a navigation to an address on this
// machine. A run where one of those succeeds is the failure this script
// exists to catch. What it does to the site: a CDP session on a guest is
// itself something a bot check can notice for the life of that renderer,
// so reload the tab before judging a site's "Verify you are human".
//
// Exit code: 0 when every check held, 1 when one did not or no window is up.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-aichat -> skills -> .claude|.github -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const CDP_MODULE_PATH = path.join(
  REPO_ROOT,
  'tools',
  'owa-devtools-mcp',
  'cdp.mjs',
);

const { evaluateInTarget, requireLivePort } = await import(
  pathToFileURL(CDP_MODULE_PATH).href
);
const { readLiveInstances } = await import(
  pathToFileURL(
    path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp', 'discovery.mjs'),
  ).href,
);

const isJson = process.argv.includes('--json');
const PARTITION = 'persist:aichat';

// The host page: no node, and only the guests it is allowed.
const HOST_EXPRESSION = `(() => {
    const guests = Array.from(document.querySelectorAll('webview'));
    return {
        hasRequire: typeof require !== 'undefined',
        hasModule: typeof module !== 'undefined',
        processEnvKeyCount:
            typeof process === 'undefined'
                ? -1
                : Object.keys(process.env || {}).length,
        guestCount: guests.length,
        partitions: guests.map((guest) => guest.getAttribute('partition')),
        allowpopups: guests.map((guest) => guest.getAttribute('allowpopups')),
        nodeAttributeCount: guests.filter((guest) => {
            return (
                guest.hasAttribute('nodeintegration') ||
                guest.hasAttribute('preload') ||
                guest.hasAttribute('webpreferences') ||
                guest.hasAttribute('disablewebsecurity')
            );
        }).length,
    };
})()`;

// The guest: what a page there can see and do.
const GUEST_EXPRESSION = `(async () => {
    const out = {
        url: location.href,
        hasRequire: typeof require !== 'undefined',
        // A site's own bundle may polyfill a bare 'process' (webpack does);
        // what must never be there is ELECTRON's, which carries its versions.
        hasElectronProcess:
            typeof process !== 'undefined' &&
            Boolean(process.versions && process.versions.electron),
        hasModule: typeof module !== 'undefined',
        webdriver: navigator.webdriver === true,
        userAgent: navigator.userAgent,
        brands: (navigator.userAgentData && navigator.userAgentData.brands
            ? navigator.userAgentData.brands
            : []
        ).map((one) => one.brand),
        isTop: window.top === window,
    };
    const query = async (name) => {
        try {
            const status = await navigator.permissions.query({ name });
            return status.state;
        } catch (error) {
            return 'unsupported';
        }
    };
    out.permissions = {
        notifications: await query('notifications'),
        geolocation: await query('geolocation'),
        camera: await query('camera'),
        microphone: await query('microphone'),
        clipboardRead: await query('clipboard-read'),
        clipboardWrite: await query('clipboard-write'),
    };
    // A window onto this machine or the app must be DENIED: the handler
    // answers null, and only ever hands an http(s) address to the system
    // browser, so neither of these can open anything anywhere.
    const tryOpen = (address) => {
        try {
            return window.open(address) === null;
        } catch (error) {
            return true;
        }
    };
    out.fileOpenDenied = tryOpen('file:///C:/');
    out.appOpenDenied = tryOpen('owa://local/presenter.html');
    // A navigation to either must leave the guest where it is.
    const before = location.href;
    try {
        location.assign('owa://local/presenter.html');
    } catch (error) {}
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
        location.assign('file:///C:/');
    } catch (error) {}
    await new Promise((resolve) => setTimeout(resolve, 400));
    out.navigationRefused = location.href === before;
    return out;
})()`;

// The fifth wall: what the guest can REACH on this machine.
//
// The other four keep the site out of the app. None of them touches the fact
// that the site runs on a machine whose loopback carries this app's own two
// doors -- the CDP endpoint (a WebSocket into renderers that all have node
// integration) and the MCP host (click, present, write a file) -- plus the
// church's router, NAS and printers. Measured 2026-09-12 BEFORE the wall
// existed: a cross-origin read of either door was refused by CORS and a CDP
// WebSocket by Chromium's own origin rule, but a `no-cors` fetch at both went
// out and was served. A blind request needs no permission and reads no answer,
// which is all a state-changing call needs.
//
// The last entry is a POSITIVE control and is the point of the section: a wall
// that also blocks the site is a brick, and would show up here as the site's
// own origin becoming unreachable.
function genReachExpression(cdpPort, mcpUrl) {
  return `(async () => {
    const out = {};
    const reach = async (label, url, init) => {
      try {
        const response = await fetch(url, init);
        out[label] = { reached: true, detail: 'status ' + response.status };
      } catch (error) {
        out[label] = { reached: false, detail: String(error).slice(0, 60) };
      }
    };
    const blind = { mode: 'no-cors' };
    await reach('cdp', 'http://127.0.0.1:${cdpPort}/json/list', blind);
    await reach('mcp', ${JSON.stringify(mcpUrl)}, {
      ...blind,
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
    });
    // Loopback written the ways a check on the raw string misses. A URL
    // parser canonicalises the first three; the fourth is loopback that is
    // simply not 127.0.0.1, which is what a pattern list would let through.
    await reach('alias127_1', 'http://127.1:${cdpPort}/json/list', blind);
    await reach('aliasDecimal', 'http://2130706433:${cdpPort}/json/list', blind);
    await reach('aliasHex', 'http://0x7f.1:${cdpPort}/json/list', blind);
    await reach('alias127_0_0_2', 'http://127.0.0.2:${cdpPort}/', blind);
    await reach('ipv6Loopback', 'http://[::1]:${cdpPort}/json/list', blind);
    await reach('router', 'http://192.168.1.1/', blind);
    await reach('metadata', 'http://169.254.169.254/latest/meta-data/', blind);
    await reach('singleLabelName', 'http://printer/', blind);
    await reach('ownOrigin', location.origin + '/favicon.ico', blind);
    return out;
  })()`;
}

// label -> what a person reading the report needs to know it means.
const REACH_CHECK_LIST = [
  ['cdp', 'the app’s own CDP door is unreachable'],
  ['mcp', 'the app’s own MCP door is unreachable'],
  ['alias127_1', 'loopback written 127.1 is unreachable'],
  ['aliasDecimal', 'loopback written as a decimal is unreachable'],
  ['aliasHex', 'loopback written in hex is unreachable'],
  ['alias127_0_0_2', 'loopback that is not 127.0.0.1 is unreachable'],
  ['ipv6Loopback', 'IPv6 loopback is unreachable'],
  ['router', 'the local network (a router) is unreachable'],
  ['metadata', 'the link-local metadata address is unreachable'],
  ['singleLabelName', 'a single-label name (printer) is unreachable'],
];

const checks = [];
function check(scope, name, isHeld, detail) {
  checks.push({ scope, name, isHeld: Boolean(isHeld), detail });
}

async function listAllTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`CDP /json/list answered ${res.status}`);
  }
  return res.json();
}

function toHostLabel(url) {
  try {
    return new URL(url).host;
  } catch (error) {
    return url;
  }
}

async function probeHost(target) {
  const host = await evaluateInTarget(target, HOST_EXPRESSION);
  const scope = 'host';
  check(scope, 'require is gone', !host.hasRequire, `${host.hasRequire}`);
  check(scope, 'module is gone', !host.hasModule, `${host.hasModule}`);
  check(
    scope,
    'process is a decoy with an empty env',
    host.processEnvKeyCount === 0,
    `${host.processEnvKeyCount} keys`,
  );
  check(
    scope,
    'no more than three guests are mounted',
    host.guestCount <= 3,
    `${host.guestCount} mounted`,
  );
  check(
    scope,
    'every guest is on the locked-down partition',
    host.partitions.every((one) => one === PARTITION),
    host.partitions.join(', ') || 'no guest',
  );
  check(
    scope,
    'every guest carries allowpopups (so popups reach the handler)',
    host.allowpopups.every((one) => one === ''),
    host.allowpopups.map((one) => JSON.stringify(one)).join(', ') || 'no guest',
  );
  check(
    scope,
    'no guest asks for node, a preload or looser preferences',
    host.nodeAttributeCount === 0,
    `${host.nodeAttributeCount} such attributes`,
  );
  return host;
}

async function probeGuest(target) {
  const guest = await evaluateInTarget(target, GUEST_EXPRESSION, 20000);
  const scope = `guest ${toHostLabel(guest.url)}`;
  check(
    scope,
    'require is unreachable',
    !guest.hasRequire,
    `${guest.hasRequire}`,
  );
  check(
    scope,
    'Electron’s process object is unreachable',
    !guest.hasElectronProcess,
    `${guest.hasElectronProcess}`,
  );
  check(scope, 'module is unreachable', !guest.hasModule, `${guest.hasModule}`);
  check(
    scope,
    'navigator.webdriver is not announced',
    !guest.webdriver,
    `${guest.webdriver}`,
  );
  check(
    scope,
    'the user agent is Electron’s own (no lie for a bot check to catch)',
    /Electron\//.test(guest.userAgent),
    guest.userAgent,
  );
  check(
    scope,
    'the guest is its own top window',
    guest.isTop,
    `${guest.isTop}`,
  );
  for (const [name, state] of Object.entries(guest.permissions)) {
    if (name === 'clipboardWrite') {
      // The one permission a Copy button needs; reported, not judged.
      check(scope, `permission ${name} (allowed on purpose)`, true, state);
      continue;
    }
    check(
      scope,
      `permission ${name} is refused`,
      state === 'denied' || state === 'unsupported',
      state,
    );
  }
  check(
    scope,
    'window.open of a file: address is denied',
    guest.fileOpenDenied,
    `${guest.fileOpenDenied}`,
  );
  check(
    scope,
    'window.open of an app page is denied',
    guest.appOpenDenied,
    `${guest.appOpenDenied}`,
  );
  check(
    scope,
    'a navigation to file: or an app page is refused',
    guest.navigationRefused,
    `${guest.navigationRefused}`,
  );
  return guest;
}

async function probeGuestReach(target, cdpPort, mcpUrl) {
  const reach = await evaluateInTarget(
    target,
    genReachExpression(cdpPort, mcpUrl),
    30000,
  );
  const scope = `guest ${toHostLabel(target.url)} — what it can reach`;
  for (const [key, name] of REACH_CHECK_LIST) {
    const one = reach[key] ?? { reached: true, detail: 'was not tried' };
    check(scope, name, !one.reached, one.detail);
  }
  const own = reach.ownOrigin ?? { reached: false, detail: 'was not tried' };
  // Not a wall: the proof that the wall is not a brick.
  check(
    scope,
    'the site’s own origin is STILL reachable (the wall is not a brick)',
    own.reached,
    own.detail,
  );
  return reach;
}

function printReport(hostTarget, guestTargets, report) {
  if (isJson) {
    console.log(JSON.stringify({ checks, report }, null, 2));
    return;
  }
  console.log(`AI Chat window: ${hostTarget.url}`);
  console.log(
    `Guests (${guestTargets.length}): ${
      guestTargets.map((one) => toHostLabel(one.url)).join(', ') || 'none'
    }`,
  );
  console.log('');
  let lastScope = null;
  for (const one of checks) {
    if (one.scope !== lastScope) {
      console.log(`[${one.scope}]`);
      lastScope = one.scope;
    }
    console.log(
      `  ${one.isHeld ? 'held ' : 'FAILED'}  ${one.name}  — ${one.detail}`,
    );
  }
  const failed = checks.filter((one) => !one.isHeld);
  console.log('');
  console.log(
    failed.length === 0
      ? `Every check held (${checks.length}).`
      : `${failed.length} of ${checks.length} checks FAILED.`,
  );
  console.log(
    'Reload any probed tab before judging a site’s own bot check: a CDP session on a guest is itself visible to one.',
  );
}

async function main() {
  const port = await requireLivePort();
  const targets = await listAllTargets(port);
  const hostTarget = targets.find((one) => {
    return one.type === 'page' && String(one.url).includes('aichat.html');
  });
  if (hostTarget === undefined) {
    console.error(
      'The AI Chat window is not open. Press the ✨ button (right of the 🤖) and pick a site, then run this again.',
    );
    process.exit(1);
  }
  const guestTargets = targets.filter((one) => {
    return one.type === 'webview';
  });
  if (guestTargets.length === 0) {
    console.error(
      'The AI Chat window is open but holds no site yet. Pick one on its card, then run this again.',
    );
    process.exit(1);
  }
  // This instance's own MCP door, so the check names the port actually
  // listening rather than the default one.
  const mcpUrl =
    readLiveInstances().find((one) => {
      return one.port === port;
    })?.mcpUrl ?? 'http://127.0.0.1:39223/mcp';
  const report = { host: await probeHost(hostTarget), guests: [] };
  for (const target of guestTargets) {
    try {
      report.guests.push(await probeGuest(target));
      await probeGuestReach(target, port, mcpUrl);
    } catch (error) {
      check(
        `guest ${toHostLabel(target.url)}`,
        'could be probed at all',
        false,
        error.message,
      );
    }
  }
  printReport(hostTarget, guestTargets, report);
  process.exit(checks.every((one) => one.isHeld) ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
