// The firewall's outbound half where its sibling suites stop: structured
// content the scrub cannot read as JSON, or cannot read back once scrubbed,
// FAILS CLOSED; a reply that is no tool result goes out untouched; and the
// bounded memory of in-flight change calls forgets its OLDEST first, so an
// answer it no longer waits for earns no "own change" pass on the removal
// budget (BN-46 fails closed too).

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkToolCall,
  guardToolCalls,
  resetFirewallState,
} from './firewall.mjs';

const REDACTED = '[redacted by the app firewall]';
const SECRET = `sk-ant-api03-${'A'.repeat(40)}`;

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
  guardToolCalls(transport, { log: () => {} });
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

function genStructuredResult(id, structuredContent) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: 'see the structured answer' }],
      structuredContent,
    },
  };
}

beforeEach(() => {
  resetFirewallState();
  vi.stubEnv('OWA_MCP_FIREWALL', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('structured content', () => {
  test('with nothing to scrub it goes out as the very object it was', () => {
    const { transport, sent } = genTransport();
    transport.onmessage(genCall(1, 'list_network_requests'));
    const structured = { requests: [{ url: 'https://example.com/' }] };
    transport.send(genStructuredResult(1, structured));
    expect(sent[0].result.structuredContent).toBe(structured);
  });

  test('that cannot be read as JSON is withheld, not let out unscrubbed', () => {
    const { transport, sent } = genTransport();
    transport.onmessage(genCall(1, 'list_network_requests'));
    transport.onmessage(genCall(2, 'list_network_requests'));
    // A BigInt and a loop are both past JSON; either could hide a key.
    transport.send(
      genStructuredResult(1, { size: 10n, header: `x-api-key: ${SECRET}` }),
    );
    const looped = { note: `Bearer ${SECRET}` };
    looped.self = looped;
    transport.send(genStructuredResult(2, looped));
    expect(sent[0].result.structuredContent).toEqual({ redacted: REDACTED });
    expect(sent[1].result.structuredContent).toEqual({ redacted: REDACTED });
    // The readable answer in `content` still goes.
    expect(sent[0].result.content).toEqual([
      { type: 'text', text: 'see the structured answer' },
    ]);
  });

  test('that the scrub leaves unreadable fails closed', () => {
    const { transport, sent } = genTransport();
    transport.onmessage(genCall(1, 'list_network_requests'));
    transport.onmessage(genCall(2, 'list_console_messages'));
    // A number under a credential's name becomes the marker, unquoted.
    transport.send(genStructuredResult(1, { password: 123456789012 }));
    // A value cut at an escaped quote leaves the rest of the string loose.
    transport.send(genStructuredResult(2, { secret: 'abcdefgh"tail9876' }));
    expect(sent[0].result.structuredContent).toEqual({ redacted: REDACTED });
    expect(sent[1].result.structuredContent).toEqual({ redacted: REDACTED });
    expect(JSON.stringify(sent)).not.toContain('123456789012');
    expect(JSON.stringify(sent)).not.toContain('abcdefgh');
  });

  test('that JSON has no text for is left as it is', () => {
    const { transport, sent } = genTransport();
    transport.onmessage(genCall(1, 'list_pages'));
    const structured = () => {
      return 'never serialised';
    };
    transport.send(genStructuredResult(1, structured));
    expect(sent[0].result.structuredContent).toBe(structured);
  });
});

describe('a reply that is no tool result', () => {
  test('an error, or a result that is not an object, goes out untouched', () => {
    const { transport, sent } = genTransport();
    const failed = {
      jsonrpc: '2.0',
      id: 41,
      error: { code: -32601, message: 'Method not found' },
    };
    const bare = { jsonrpc: '2.0', id: 42, result: 'pong' };
    const empty = { jsonrpc: '2.0', id: 43, result: null };
    transport.send(failed);
    transport.send(bare);
    transport.send(empty);
    expect(sent).toEqual([failed, bare, empty]);
    expect(sent[0]).toBe(failed);
    expect(sent[1].result).toBe('pong');
  });
});

describe('the change calls waited on', () => {
  // 64 at most are remembered. Spread over time so the 25-a-minute acting
  // budget refuses none of them; the removal budget is full throughout.
  test('past 64 in flight the oldest is forgotten, and its undo is counted as a removal', () => {
    const start = Date.parse('2026-11-09T09:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
    for (let index = 0; index < 10; index += 1) {
      expect(
        checkToolCall('owa_bible_note', { action: 'delete', id: index })
          .isAllowed,
      ).toBe(true);
    }
    const { transport, forwarded, sent } = genTransport();
    for (let id = 1; id <= 65; id += 1) {
      vi.setSystemTime(start + 61 * 1000 + id * 3000);
      transport.onmessage(
        genCall(id, 'owa_note_edit', { action: 'edit', changes: [] }),
      );
    }
    expect(forwarded.map((message) => message.id)).toEqual(
      Array.from({ length: 65 }, (_, index) => index + 1),
    );
    for (const id of [1, 65]) {
      transport.send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ isChanged: true, undoId: `own-${id}` }),
            },
          ],
        },
      });
    }
    expect(sent).toHaveLength(2);
    // Still inside the five minutes the ten removals fill.
    vi.setSystemTime(start + 4 * 60 * 1000 + 30 * 1000);
    transport.onmessage(
      genCall(100, 'owa_undo', { action: 'undo', id: 'own-65' }),
    );
    transport.onmessage(
      genCall(101, 'owa_undo', { action: 'undo', id: 'own-1' }),
    );
    expect(forwarded.at(-1).id).toBe(100);
    expect(forwarded).toHaveLength(66);
    expect(sent.at(-1)).toMatchObject({ id: 101, result: { isError: true } });
    expect(sent.at(-1).result.content[0].text).toMatch(
      /^Too many things removed in the last few minutes\./,
    );
  });
});
