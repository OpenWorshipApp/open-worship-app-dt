import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkIsDestructiveText,
  genUidLabelMemory,
  getFirewallLog,
  guardToolCalls,
  resetFirewallState,
} from './firewall.mjs';

// The firewall on the seam both doors share: every call is checked on its way
// in, every result scrubbed (and read for destructive uids) on its way out.
// A transport here is two recorders -- what reached the server below, and
// what went back to the client.
const PRESENTER_SNAPSHOT = [
  '## Latest page snapshot',
  'uid=1_0 RootWebArea "Open Worship app - Presenter" url="x"',
  '  uid=1_112 button "Clear All" description="Clear All [F6]"',
  '  uid=1_115 button "Clear Long Text" description="Clear Long Text [F9]"',
  '  uid=1_117 button "Move to Trash" description="Move to Trash"',
].join('\n');

const SECRET = `sk-ant-api03-${'A'.repeat(40)}`;
const REDACTED = '[redacted by the app firewall]';

function genTransport() {
  const forwarded = [];
  const sent = [];
  const transport = {
    onmessage(message) {
      forwarded.push(message);
    },
    send(message) {
      sent.push(message);
    },
  };
  return { transport, forwarded, sent };
}

function genCall(id, name, args = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  };
}

function genResult(id, text) {
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text }] },
  };
}

const tempDirList = [];

function genTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-'));
  tempDirList.push(dir);
  return dir;
}

beforeEach(() => {
  resetFirewallState();
  vi.stubEnv('OWA_MCP_FIREWALL', '');
});

afterEach(() => {
  for (const dir of tempDirList.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
});

describe('the decision log', () => {
  test('keeps the last 100 decisions, the oldest dropped first', () => {
    const { transport } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(0, 'take_heapsnapshot'));
    for (let id = 1; id <= 100; id += 1) {
      transport.onmessage(genCall(id, 'evaluate_script'));
    }
    const log = getFirewallLog();
    expect(log).toHaveLength(100);
    expect(
      log.every((entry) => {
        return entry.name === 'evaluate_script';
      }),
    ).toBe(true);
    expect(log[0]).toEqual({
      at: expect.any(Number),
      name: 'evaluate_script',
      rule: 'denied-tool',
      isAllowed: false,
    });
    // What an operator is handed is a copy, not the log itself.
    log.length = 0;
    expect(getFirewallLog()).toHaveLength(100);
  });

  // An operator asking what was done needs to see where it went.
  test('a page read off the internet is logged with its address', () => {
    const { transport, forwarded } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(
      genCall(1, 'owa_read_website', { url: 'https://example.com/page' }),
    );
    expect(
      forwarded.map((message) => {
        return message.id;
      }),
    ).toEqual([1]);
    expect(getFirewallLog().at(-1)).toEqual({
      at: expect.any(Number),
      name: 'owa_read_website',
      rule: 'fetched',
      isAllowed: true,
      url: 'https://example.com/page',
    });
  });

  test('without a log of its own a refusal is written to stderr', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { transport, sent } = genTransport();
    guardToolCalls(transport);
    transport.onmessage(genCall(1, 'evaluate_script', { function: '1' }));
    expect(errorSpy).toHaveBeenCalledWith(
      '[owa-devtools-mcp firewall]',
      'refused evaluate_script (denied-tool)',
    );
    expect(sent[0].result.isError).toBe(true);
  });
});

describe('checkIsDestructiveText', () => {
  test('nothing that is not words is destructive', () => {
    for (const value of [undefined, null, '', 42, ['Delete']]) {
      expect(checkIsDestructiveText(value)).toBe(false);
    }
  });

  test('reads a label the way the interlock does', () => {
    expect(checkIsDestructiveText('Move to Trash')).toBe(true);
    expect(checkIsDestructiveText('Clear All [F6]')).toBe(true);
    // Bare "clear" is an ordinary presenting move.
    expect(checkIsDestructiveText('Clear Long Text')).toBe(false);
  });
});

describe('the uid memory', () => {
  test('prose that only mentions uid= is not a snapshot and wipes nothing', () => {
    const memory = genUidLabelMemory();
    memory.remember(PRESENTER_SNAPSHOT);
    expect(memory.size).toBe(2);
    memory.remember('chrome-devtools names a node with uid= and a number');
    expect(memory.size).toBe(2);
    expect(memory.lookup('1_112')).toBe(
      '"Clear All" description="Clear All [F6]"',
    );
  });

  // One entry for the presenter's whole tree is what it costs normally; a
  // page that is nothing but delete buttons must not grow it past its bound.
  test('is bounded, keeping the first rows it was shown', () => {
    const memory = genUidLabelMemory({ limit: 2 });
    memory.remember(
      [
        'uid=2_0 RootWebArea "Lists"',
        '  uid=2_1 button "Delete"',
        '  uid=2_2 button "Remove Background"',
        '  uid=2_3 button "Move to Trash"',
      ].join('\n'),
    );
    expect(memory.size).toBe(2);
    expect(memory.lookup('2_1')).toBe('"Delete"');
    expect(memory.lookup('2_2')).toBe('"Remove Background"');
    expect(memory.lookup('2_3')).toBe(null);
  });
});

describe('the scrub on the way out', () => {
  test('a picture is passed through as it is, and the words beside it scrubbed', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(1, 'take_screenshot'));
    const picture = {
      type: 'image',
      data: 'iVBORw0KGgo=',
      mimeType: 'image/png',
    };
    transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [picture, { type: 'text', text: `key ${SECRET}` }],
      },
    });
    expect(sent[0].result.content[0]).toBe(picture);
    expect(sent[0].result.content[1].text).toBe(`key ${REDACTED}`);
  });

  test('a result with no content list goes out untouched, and the next is still scrubbed', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(1, 'list_pages'));
    transport.onmessage(genCall(2, 'list_pages'));
    transport.send({ jsonrpc: '2.0', id: 1, result: { isError: true } });
    transport.send(genResult(2, `Bearer ${SECRET}`));
    expect(sent[0].result).toEqual({ isError: true });
    expect(sent[1].result.content[0].text).not.toContain(SECRET);
  });

  // A client may abandon requests; what is remembered about them is bounded,
  // and the results still owed are scrubbed as before.
  test('past 64 calls in flight the newest result is still scrubbed', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    for (let id = 1; id <= 65; id += 1) {
      transport.onmessage(genCall(id, 'list_network_requests'));
    }
    transport.send(genResult(65, `x-api-key: ${SECRET}`));
    expect(sent[0].result.content[0].text).toBe(`x-api-key: ${REDACTED}`);
  });

  test('a broken snapshot reader is logged, and the scrubbed result still goes out', () => {
    const logList = [];
    const { transport, sent } = genTransport();
    guardToolCalls(transport, {
      log: (text) => {
        logList.push(text);
      },
      readSnapshotFile: () => {
        throw new Error('disk on fire');
      },
    });
    transport.onmessage(genCall(1, 'take_snapshot', { filePath: 'snap.txt' }));
    transport.send(genResult(1, `Saved snapshot. token=${SECRET}`));
    expect(logList).toEqual(['firewall scrub failed: disk on fire']);
    expect(sent).toHaveLength(1);
    expect(sent[0].result.content[0].text).not.toContain(SECRET);
  });
});

describe('a snapshot written to a file', () => {
  // `take_snapshot {filePath}` answers only "Saved snapshot to <path>", and a
  // click on Discard changed went through (the 2026-09-29 robot run). The
  // file is read before the result is released.
  test('is read before its result goes out, so a click on its uid is refused', () => {
    const filePath = path.join(genTempDir(), 'snapshot.txt');
    fs.writeFileSync(filePath, PRESENTER_SNAPSHOT);
    const { transport, forwarded, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });

    transport.onmessage(genCall(1, 'take_snapshot', { filePath }));
    transport.send(genResult(1, `Saved snapshot to ${filePath}`));
    transport.onmessage(genCall(2, 'click', { uid: '1_112' }));

    expect(
      forwarded.map((message) => {
        return message.id;
      }),
    ).toEqual([1]);
    expect(sent.at(-1)).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: {
        content: [
          { type: 'text', text: expect.stringContaining('"Clear All') },
        ],
        isError: true,
      },
    });
  });

  test('a file that cannot be read does not break the result', () => {
    const missingPath = path.join(genTempDir(), 'never-written.txt');
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(1, 'take_snapshot', { filePath: missingPath }));
    expect(() => {
      transport.send(genResult(1, `Saved snapshot to ${missingPath}`));
    }).not.toThrow();
    expect(sent).toEqual([genResult(1, `Saved snapshot to ${missingPath}`)]);
  });

  // A real snapshot is a few hundred kilobytes; the send path must not stall
  // reading something far bigger.
  test('a file over 8 MB is never read back', () => {
    const bigPath = path.join(genTempDir(), 'huge.txt');
    fs.writeFileSync(
      bigPath,
      `${PRESENTER_SNAPSHOT}\n${' '.repeat(8 * 1024 * 1024)}`,
    );
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(1, 'take_snapshot', { filePath: bigPath }));
    transport.send(genResult(1, `Saved snapshot to ${bigPath}`));
    expect(sent).toHaveLength(1);
    expect(
      readSpy.mock.calls.some(([filePath]) => {
        return String(filePath) === path.resolve(bigPath);
      }),
    ).toBe(false);
  });

  test('past 64 snapshots in flight the newest one is still read', () => {
    const readList = [];
    const { transport, forwarded, sent } = genTransport();
    guardToolCalls(transport, {
      log: () => {},
      readSnapshotFile: (filePath) => {
        readList.push(filePath);
        return PRESENTER_SNAPSHOT;
      },
    });
    for (let id = 1; id <= 65; id += 1) {
      transport.onmessage(
        genCall(id, 'take_snapshot', { filePath: `snap-${id}.txt` }),
      );
    }
    transport.send(genResult(65, 'Saved snapshot to snap-65.txt'));
    expect(readList).toEqual(['snap-65.txt']);
    transport.onmessage(genCall(66, 'click', { uid: '1_117' }));
    expect(forwarded.at(-1).id).toBe(65);
    expect(sent.at(-1).result.isError).toBe(true);
  });
});

// Found writing the tests above (UT-73, 2026-11-03) and fixed in the firewall:
// each of these let a call through or a secret out.
describe('the gaps the coverage run found', () => {
  // The catch said "must fail CLOSED" and then forwarded the call anyway.
  test('a call whose check throws is refused, not forwarded, and the session goes on', () => {
    const logList = [];
    const { transport, forwarded, sent } = genTransport();
    guardToolCalls(transport, {
      log: (text) => {
        logList.push(text);
      },
    });
    // `String()` of this throws inside the key interlock.
    transport.onmessage(genCall(1, 'owa_press_key', { keys: { toString: 1 } }));
    expect(forwarded).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0].id).toBe(1);
    expect(sent[0].result.isError).toBe(true);
    expect(sent[0].result.content[0].text).toContain('was not run');
    expect(logList).toHaveLength(1);
    expect(logList[0]).toMatch(/^firewall check failed: /);
    expect(getFirewallLog().at(-1)).toMatchObject({
      name: 'owa_press_key',
      rule: 'check-failed',
      isAllowed: false,
    });
    // The next well-formed call is judged and forwarded as usual.
    transport.onmessage(genCall(2, 'list_pages'));
    expect(
      forwarded.map((message) => {
        return message.id;
      }),
    ).toEqual([2]);
  });

  // The pending map holds 64 ids; the 65th evicted the first, and the first
  // one's result then went out with nothing scrubbed.
  test('a result whose request was forgotten is still scrubbed', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    for (let id = 1; id <= 65; id += 1) {
      transport.onmessage(genCall(id, 'list_network_requests'));
    }
    transport.send(genResult(1, `x-api-key: ${SECRET}`));
    expect(sent[0].result.content[0].text).toBe(`x-api-key: ${REDACTED}`);
    // And one the firewall never saw asked at all.
    transport.send(genResult(999, `Bearer ${SECRET}`));
    expect(sent[1].result.content[0].text).not.toContain(SECRET);
  });

  test('a tool list whose request was forgotten still has the denied tools taken out', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    for (let id = 2; id <= 66; id += 1) {
      transport.onmessage(genCall(id, 'list_pages'));
    }
    transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [{ name: 'evaluate_script' }, { name: 'list_pages' }],
      },
    });
    expect(
      sent[0].result.tools.map((tool) => {
        return tool.name;
      }),
    ).toEqual(['list_pages']);
  });

  test('a result that is not a tool result goes out untouched', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    const initialize = {
      jsonrpc: '2.0',
      id: 7,
      result: { protocolVersion: '2025-06-18', capabilities: {} },
    };
    transport.send(initialize);
    expect(sent[0]).toBe(initialize);
    expect(sent[0].result).toEqual({
      protocolVersion: '2025-06-18',
      capabilities: {},
    });
  });

  // chrome-devtools-mcp can answer in `structuredContent` beside `content`
  // (`--experimentalStructuredContent`); only `content` was scrubbed.
  test('a secret in structured content is scrubbed too', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(genCall(1, 'list_network_requests'));
    transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: 'two requests' }],
        structuredContent: {
          requests: [
            {
              url: 'https://api.anthropic.com/v1/messages',
              headers: { 'x-api-key': 'plainvalue12345', accept: '*/*' },
              note: `sent ${SECRET}`,
            },
            { url: 'https://example.com/', status: 200, isCached: false },
          ],
          password: 'hunter2hunter2',
          count: 2,
        },
      },
    });
    const structured = sent[0].result.structuredContent;
    expect(structured.requests[0].headers['x-api-key']).toBe(REDACTED);
    expect(structured.requests[0].headers.accept).toBe('*/*');
    expect(structured.requests[0].note).toBe(`sent ${REDACTED}`);
    expect(structured.requests[0].url).toBe(
      'https://api.anthropic.com/v1/messages',
    );
    expect(structured.requests[1]).toEqual({
      url: 'https://example.com/',
      status: 200,
      isCached: false,
    });
    expect(structured.password).toBe(REDACTED);
    expect(structured.count).toBe(2);
    expect(JSON.stringify(sent[0])).not.toContain(SECRET);
    expect(JSON.stringify(sent[0])).not.toContain('plainvalue12345');
  });

  // The log asked "is this a network TOOL", so a call that reaches the
  // internet only because it carries a url was never logged as one.
  test('a call that reaches the internet by its url is logged with the address', () => {
    const { transport, forwarded } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(
      genCall(1, 'owa_lyric_validate', { url: 'https://example.com/song' }),
    );
    expect(forwarded).toHaveLength(1);
    expect(getFirewallLog().at(-1)).toEqual({
      at: expect.any(Number),
      name: 'owa_lyric_validate',
      rule: 'fetched',
      isAllowed: true,
      url: 'https://example.com/song',
    });
    transport.onmessage(
      genCall(2, 'owa_bible_xml', {
        action: 'check',
        url: 'https://example.com/bible.xml',
      }),
    );
    expect(forwarded).toHaveLength(2);
    expect(getFirewallLog().at(-1)).toEqual({
      at: expect.any(Number),
      name: 'owa_bible_xml',
      rule: 'acted',
      isAllowed: true,
      url: 'https://example.com/bible.xml',
    });
    // Without a url neither goes anywhere, and neither is logged as fetched.
    transport.onmessage(genCall(3, 'owa_lyric_validate', { text: 'x' }));
    expect(getFirewallLog().at(-1).name).toBe('owa_bible_xml');
  });
});
