import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  checkIsDestructiveText,
  genUidLabelMemory,
  getFirewallLog,
  guardToolCalls,
  recordPressRefusal,
  resetFirewallState,
} from './firewall.mjs';

// The firewall's edges: its log is bounded, its memory of destructive uids is
// bounded and only ever replaced by a real snapshot, a snapshot written to a
// FILE is read off the disk, and its bookkeeping per request stays bounded.

let dirPath = '';

beforeAll(() => {
  dirPath = mkdtempSync(path.join(os.tmpdir(), 'owa-firewall-'));
});

afterAll(() => {
  rmSync(dirPath, { recursive: true, force: true });
});

beforeEach(() => {
  resetFirewallState();
});

function genTransport() {
  const seen = [];
  const sent = [];
  const transport = {
    onmessage: (message) => seen.push(message),
    send: (message) => sent.push(message),
  };
  return { transport, seen, sent };
}

function callMessage(id, name, args = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  };
}

describe('the decision log', () => {
  it('keeps the last hundred decisions and drops the oldest', () => {
    for (let index = 0; index < 105; index += 1) {
      recordPressRefusal(`tool-${index}`, { refused: 'destructive' });
    }
    const log = getFirewallLog();
    expect(log).toHaveLength(100);
    expect(log[0].name).toBe('tool-5');
    expect(log.at(-1)).toMatchObject({
      name: 'tool-104',
      rule: 'destructive-press',
      isAllowed: false,
    });
  });
});

describe('checkIsDestructiveText', () => {
  it('reads words that cannot be undone, and nothing out of no words', () => {
    expect(checkIsDestructiveText('Move to Trash')).toBe(true);
    expect(checkIsDestructiveText('Clear Long Text')).toBe(false);
    expect(checkIsDestructiveText('')).toBe(false);
    expect(checkIsDestructiveText(null)).toBe(false);
  });
});

describe('the uid memory', () => {
  const snapshot = [
    'uid=3_0 RootWebArea "Presenter"',
    '  uid=3_7 button "Move to Trash"',
    '  uid=3_8 button "Discard changed"',
  ].join('\n');

  it('holds no more destructive uids than its limit', () => {
    const memory = genUidLabelMemory({ limit: 1 });
    memory.remember(snapshot);
    expect(memory.lookup('3_7')).toBe('"Move to Trash"');
    expect(memory.lookup('3_8')).toBeNull();
  });

  it('is not emptied by a result that only mentions a uid', () => {
    const memory = genUidLabelMemory();
    memory.remember(snapshot);
    memory.remember('Clicked the element with uid=3_7 in the page.');
    expect(memory.lookup('3_7')).toBe('"Move to Trash"');
    expect(memory.lookup('3_8')).toBe('"Discard changed"');
  });
});

describe('a snapshot written to a file', () => {
  function snapshotTo(transport, id, filePath) {
    transport.onmessage(callMessage(id, 'take_snapshot', { filePath }));
    transport.send({
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: `Saved snapshot to ${filePath}.` }],
      },
    });
  }

  it('is read off the disk, so its destructive uids are refused', () => {
    const filePath = path.join(dirPath, 'snapshot.txt');
    writeFileSync(
      filePath,
      '  uid=9_4 button "Discard changed" description="Discard changed"',
    );
    const { transport, seen, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    snapshotTo(transport, 1, filePath);
    transport.onmessage(callMessage(2, 'click', { pageId: 1, uid: '9_4' }));
    expect(seen.map((one) => one.id)).toEqual([1]);
    expect(sent.at(-1).id).toBe(2);
    expect(sent.at(-1).result.isError).toBe(true);
  });

  it('is skipped when it is missing or past the size cap, failing open', () => {
    const bigPath = path.join(dirPath, 'big-snapshot.txt');
    writeFileSync(
      bigPath,
      Buffer.concat([
        Buffer.from('  uid=9_5 button "Discard changed"\n'),
        Buffer.alloc(8 * 1024 * 1024, 'x'),
      ]),
    );
    const { transport, seen } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    snapshotTo(transport, 1, path.join(dirPath, 'missing.txt'));
    snapshotTo(transport, 2, bigPath);
    // A uid it was never shown is one it cannot judge: forwarded.
    transport.onmessage(callMessage(3, 'click', { pageId: 1, uid: '9_5' }));
    expect(seen.map((one) => one.id)).toEqual([1, 2, 3]);
  });

  it('keeps its bookkeeping bounded and still reads the newest', () => {
    const readPaths = [];
    const { transport } = genTransport();
    guardToolCalls(transport, {
      log: () => {},
      readSnapshotFile: (filePath) => {
        readPaths.push(filePath);
        return '';
      },
    });
    for (let id = 1; id <= 70; id += 1) {
      transport.onmessage(
        callMessage(id, 'take_snapshot', { filePath: `snap-${id}.txt` }),
      );
    }
    transport.send({
      jsonrpc: '2.0',
      id: 70,
      result: { content: [{ type: 'text', text: 'Saved.' }] },
    });
    expect(readPaths).toEqual(['snap-70.txt']);
  });
});

describe('results on their way out', () => {
  it('still scrubs the newest result after many calls in flight', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    for (let id = 1; id <= 70; id += 1) {
      transport.onmessage(callMessage(id, 'owa_app_state'));
    }
    const secret = `sk-ant-api03-${'a'.repeat(40)}`;
    transport.send({
      jsonrpc: '2.0',
      id: 70,
      result: { content: [{ type: 'text', text: `key ${secret}` }] },
    });
    expect(sent[0].result.content[0].text).toBe(
      'key [redacted by the app firewall]',
    );
  });

  it('leaves a picture alone and a result with no content as it is', () => {
    const { transport, sent } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    transport.onmessage(callMessage(1, 'owa_screenshot'));
    transport.onmessage(callMessage(2, 'owa_app_state'));
    const picture = { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' };
    transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: 'A picture.' }, picture],
      },
    });
    transport.send({ jsonrpc: '2.0', id: 2, result: { isError: true } });
    expect(sent[0].result.content[1]).toBe(picture);
    expect(sent[1].result).toEqual({ isError: true });
  });
});

describe('what is let through', () => {
  it('logs a web read with the address it went to', () => {
    const { transport, seen } = genTransport();
    guardToolCalls(transport, { log: () => {} });
    const message = callMessage(1, 'owa_read_website', {
      url: 'https://example.org/hymn',
    });
    transport.onmessage(message);
    expect(seen).toEqual([message]);
    expect(getFirewallLog().at(-1)).toMatchObject({
      name: 'owa_read_website',
      rule: 'fetched',
      isAllowed: true,
      url: 'https://example.org/hymn',
    });
  });

  it('says what it refused on the console when no log was given', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { transport } = genTransport();
    guardToolCalls(transport);
    transport.onmessage(callMessage(1, 'evaluate_script', { function: '1' }));
    expect(errors).toHaveBeenCalledTimes(1);
    const [prefix, text] = errors.mock.calls[0];
    expect(prefix).toBe('[owa-devtools-mcp firewall]');
    expect(text).toMatch(/^refused evaluate_script \(/);
  });
});
