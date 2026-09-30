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
// What it does to the app: reads, plus the refusals it EXPECTS to be
// refused -- a `window.open` and a navigation to an address on this machine,
// WebSockets to loopback servers this script starts and stops itself (bound
// to loopback only, so no firewall prompt), and one `window.open` of
// example.com with nothing pressed, which must be refused and said on the
// window's own line. A run where one of those succeeds is the failure this
// script exists to catch -- for the last one, a browser window opening on
// example.com. What it does to the site: a CDP session on a guest is itself
// something a bot check can notice for the life of that renderer, so reload
// the tab before judging a site's "Verify you are human".
//
// Exit code: 0 when every check held, 1 when one did not or no window is up.

import http from 'node:http';
import { createRequire } from 'node:module';
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
  ).href
);
const { WebSocketServer } = createRequire(path.join(REPO_ROOT, 'package.json'))(
  'ws',
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
    // The camera stays refused now that the microphone is ASKED: a request
    // that wants a camera, alone or beside a microphone, is refused whole
    // and never reaches the window's line. A machine with no camera answers
    // NotFoundError, which proves less and is reported as such.
    const tryMedia = async (constraints) => {
        try {
            const stream = await Promise.race([
                navigator.mediaDevices.getUserMedia(constraints),
                new Promise((resolve, reject) => {
                    setTimeout(() => reject(new Error('no answer')), 3000);
                }),
            ]);
            stream.getTracks().forEach((track) => track.stop());
            return 'granted';
        } catch (error) {
            if (error && error.message === 'no answer') {
                return 'no answer';
            }
            return error && error.name ? error.name : String(error);
        }
    };
    out.cameraRequest = await tryMedia({ video: true });
    out.cameraWithMicRequest = await tryMedia({ audio: true, video: true });
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

// The fifth wall, for WebSockets. `*://` in a request filter means http and
// https only, so until 2026-09-14 a WebSocket handshake never reached the
// wall: from inside a claude.ai guest, `ws://` to 127.0.0.1, localhost,
// 127.1, [::1] and 127.0.0.2 all OPENED, and a server on each received the
// handshake with the site's Origin. A church machine's loopback is where OBS,
// Companion and presentation remotes listen for exactly that.
//
// The page's own answer cannot tell "refused by the wall" from "nothing
// listening", so this starts a real server on each loopback address and reads
// what ARRIVED. And the positive control again: a public echo must still open,
// or the wall has become a brick for every site's realtime socket.
const PUBLIC_WEBSOCKET_URL_LIST = [
  'wss://ws.postman-echo.com/raw',
  'wss://echo.websocket.org/',
];

function startLoopbackServer(host, port) {
  return new Promise((resolve) => {
    const received = [];
    const httpServer = http.createServer((request, response) => {
      received.push(request.url);
      response.writeHead(204);
      response.end();
    });
    const wsServer = new WebSocketServer({ server: httpServer });
    wsServer.on('connection', (socket, request) => {
      received.push(request.url);
      socket.close(1000, 'owa probe');
    });
    httpServer.on('error', () => {
      resolve(null);
    });
    httpServer.listen(port, host, () => {
      resolve({
        received,
        port: httpServer.address().port,
        close: () => {
          wsServer.close();
          httpServer.close();
        },
      });
    });
  });
}

async function startLoopbackServers() {
  const v4 = await startLoopbackServer('127.0.0.1', 0);
  if (v4 === null) {
    return null;
  }
  // The same port on the other loopback addresses, so `localhost` finds a
  // listener whichever family it resolves to. Either may be unavailable on a
  // machine; its checks are then left out rather than passed for nothing.
  const v6 = await startLoopbackServer('::1', v4.port);
  const alias = await startLoopbackServer('127.0.0.2', v4.port);
  const list = [v4, v6, alias].filter(Boolean);
  return {
    port: v4.port,
    hasIpv6: v6 !== null,
    hasAlias: alias !== null,
    readReceived: () => {
      return list.flatMap((one) => one.received);
    },
    close: () => {
      for (const one of list) {
        one.close();
      }
    },
  };
}

function genWebSocketExpression(attempts) {
  return `(async () => {
    const attempts = ${JSON.stringify(attempts)};
    const tryWs = (url, waitMs) => new Promise((resolve) => {
      let socket;
      try {
        socket = new WebSocket(url);
      } catch (error) {
        resolve({ opened: false, detail: 'threw ' + String(error).slice(0, 60) });
        return;
      }
      const timer = setTimeout(() => {
        try { socket.close(); } catch (error) {}
        resolve({ opened: false, detail: 'no answer' });
      }, waitMs);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve({ opened: true, detail: 'opened' });
        try { socket.close(); } catch (error) {}
      };
      socket.onclose = (event) => {
        clearTimeout(timer);
        resolve({ opened: false, detail: 'closed ' + event.code });
      };
    });
    const out = {};
    for (const [key, url, waitMs, skipWhenOpened] of attempts) {
      if (skipWhenOpened && out[skipWhenOpened] && out[skipWhenOpened].opened) {
        continue;
      }
      out[key] = await tryWs(url, waitMs);
    }
    return out;
  })()`;
}

async function probeGuestWebSockets(target, servers, guestIndex) {
  const scope = `guest ${toHostLabel(target.url)} — WebSockets`;
  const loopbackList = [
    ['ws127', '127.0.0.1', 'a WebSocket to 127.0.0.1 is refused', true],
    [
      'wsLocalhost',
      'localhost',
      'a WebSocket to localhost is refused',
      servers.hasIpv6,
    ],
    ['ws127_1', '127.1', 'a WebSocket to loopback written 127.1 is refused', true],
    [
      'wsIpv6',
      '[::1]',
      'a WebSocket to IPv6 loopback is refused',
      servers.hasIpv6,
    ],
    [
      'wsAlias',
      '127.0.0.2',
      'a WebSocket to loopback that is not 127.0.0.1 is refused',
      servers.hasAlias,
    ],
  ].filter((one) => {
    return one[3];
  });
  const toPath = (key) => {
    return `/owa-probe-${key}-${guestIndex}`;
  };
  const attempts = loopbackList.map(([key, host]) => {
    return [key, `ws://${host}:${servers.port}${toPath(key)}`, 3000];
  });
  PUBLIC_WEBSOCKET_URL_LIST.forEach((url, urlIndex) => {
    attempts.push([
      `public${urlIndex}`,
      url,
      8000,
      urlIndex === 0 ? null : 'public0',
    ]);
  });
  const answers = await evaluateInTarget(
    target,
    genWebSocketExpression(attempts),
    60000,
  );
  // A handshake that did get through gets a moment to be counted.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const received = servers.readReceived();
  for (const [key, , name] of loopbackList) {
    const answer = answers[key] ?? { opened: true, detail: 'was not tried' };
    const hasArrived = received.includes(toPath(key));
    check(
      scope,
      name,
      !answer.opened && !hasArrived,
      hasArrived ? `the server RECEIVED it (${answer.detail})` : answer.detail,
    );
  }
  const publicAnswers = PUBLIC_WEBSOCKET_URL_LIST.map((_url, urlIndex) => {
    return answers[`public${urlIndex}`];
  }).filter(Boolean);
  const isPublicOpen = publicAnswers.some((answer) => {
    return answer.opened;
  });
  check(
    scope,
    'a WebSocket to the public internet STILL opens (the wall is not a brick)',
    isPublicOpen,
    isPublicOpen
      ? 'opened'
      : `${publicAnswers.map((answer) => answer.detail).join(', ')} — check this machine can reach ${PUBLIC_WEBSOCKET_URL_LIST.join(' or ')}`,
  );
}

// The window-open handler, for a page's own idea. `allowpopups` is on the
// guest so a pressed link reaches the system browser, and Electron applies no
// popup blocker to a guest that has it: measured 2026-09-14, a page's timer
// opened the system browser with nothing pressed. Now a page gets one page per
// press, and a refused one is said on the window's own line -- which is what
// makes the refusal visible here at all. Only the tab in front says so.
async function probeNoPressPopup(hostTarget, guestTargets) {
  const scope = 'host — a page opening a window with nothing pressed';
  const frontUrl = await evaluateInTarget(
    hostTarget,
    `(() => {
      const shown = Array.from(document.querySelectorAll('webview')).find(
        (guest) => getComputedStyle(guest).visibility !== 'hidden',
      );
      if (!shown) {
        return null;
      }
      try {
        return shown.getURL();
      } catch (error) {
        return shown.getAttribute('src');
      }
    })()`,
  );
  const guest =
    guestTargets.length === 1
      ? guestTargets[0]
      : guestTargets.find((one) => {
          return one.url === frontUrl;
        });
  if (guest === undefined) {
    check(scope, 'the tab in front could be found', false, `${frontUrl}`);
    return;
  }
  const isDenied = await evaluateInTarget(
    guest,
    `(() => {
      try {
        return window.open('https://example.com/owa-probe-no-press') === null;
      } catch (error) {
        return true;
      }
    })()`,
  );
  let lineText = null;
  for (let attempt = 0; attempt < 15 && lineText === null; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    lineText = await evaluateInTarget(
      hostTarget,
      `(() => {
        const line = document.querySelector('[aria-label="Page not opened"]');
        return line ? line.textContent : null;
      })()`,
    );
  }
  check(scope, 'the page is handed nothing', isDenied, `${isDenied}`);
  check(
    scope,
    'the refusal is said on the window’s own line, naming the address',
    typeof lineText === 'string' && lineText.includes('example.com'),
    lineText ??
      'no line appeared — if a browser window opened on example.com the gate is NOT holding (a second run within 5 s also shows no line)',
  );
}

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
    if (name === 'microphone') {
      // ASKED since 2026-09-14: a check has no "ask me" answer in Electron,
      // and a site that reads denied shows its own "blocked" notice without
      // ever asking -- so on a site's own https page the microphone checks
      // as available, and the STREAM is what the person is asked about.
      check(
        scope,
        'permission microphone checks as askable',
        state === 'granted',
        state,
      );
      continue;
    }
    check(
      scope,
      `permission ${name} is refused`,
      state === 'denied' || state === 'unsupported',
      state,
    );
  }
  for (const [name, answer] of [
    ['a camera request', guest.cameraRequest],
    ['a camera-and-microphone request', guest.cameraWithMicRequest],
  ]) {
    check(
      scope,
      `${name} is refused without asking`,
      answer === 'NotAllowedError' || answer === 'NotFoundError',
      answer === 'NotFoundError'
        ? `${answer} (no camera on this machine, which proves less)`
        : answer,
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
  const servers = await startLoopbackServers();
  try {
    for (const [guestIndex, target] of guestTargets.entries()) {
      try {
        report.guests.push(await probeGuest(target));
        await probeGuestReach(target, port, mcpUrl);
        if (servers === null) {
          check(
            `guest ${toHostLabel(target.url)} — WebSockets`,
            'a loopback server could be started to test against',
            false,
            'nothing would bind on 127.0.0.1',
          );
        } else {
          await probeGuestWebSockets(target, servers, guestIndex);
        }
      } catch (error) {
        check(
          `guest ${toHostLabel(target.url)}`,
          'could be probed at all',
          false,
          error.message,
        );
      }
    }
    try {
      await probeNoPressPopup(hostTarget, guestTargets);
    } catch (error) {
      check(
        'host — a page opening a window with nothing pressed',
        'could be probed at all',
        false,
        error.message,
      );
    }
  } finally {
    servers?.close();
  }
  printReport(hostTarget, guestTargets, report);
  process.exit(checks.every((one) => one.isHeld) ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
