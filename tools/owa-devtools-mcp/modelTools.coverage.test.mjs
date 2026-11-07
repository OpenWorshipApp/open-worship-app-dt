import { describe, expect, it } from 'vitest';

import {
  MODEL_ASK_SHARED_TOOL_MAP,
  MODEL_ON_ASK_TOOL_MAP,
  filterModelToolList,
  pickAskToolList,
} from './modelTools.mjs';

// The chatbot hands these whatever its MCP client answered with; a failed
// listing must not throw inside the loop that sends the model its tools.
describe('a tool list that is not a list', () => {
  it('filterModelToolList hands a non-list back untouched', () => {
    expect(filterModelToolList(undefined)).toBeUndefined();
    expect(filterModelToolList(null)).toBeNull();
    const notAList = { tools: [] };
    expect(filterModelToolList(notAList)).toBe(notAList);
  });

  it('pickAskToolList offers nothing for a non-list', () => {
    expect(pickAskToolList(undefined, 'lookup')).toEqual([]);
    expect(pickAskToolList({ length: 2 }, 'lookup')).toEqual([]);
  });
});

describe('pickAskToolList', () => {
  it('offers an ask its own tools and the ordinary ones it shares', () => {
    const ownTool = Object.entries(MODEL_ON_ASK_TOOL_MAP).find(([, kind]) => {
      return kind === 'lookup';
    })[0];
    const toolList = [
      { name: ownTool },
      { name: 'owa_read_website' },
      { name: 'owa_find_ui' },
      { name: 'click' },
    ];
    const picked = pickAskToolList(toolList, 'lookup').map((tool) => {
      return tool.name;
    });
    expect(picked).toContain(ownTool);
    for (const shared of MODEL_ASK_SHARED_TOOL_MAP.lookup) {
      if (toolList.some((tool) => tool.name === shared)) {
        expect(picked).toContain(shared);
      }
    }
    // Neither the ordinary tools nor a withheld one ride along.
    expect(picked).not.toContain('owa_find_ui');
    expect(picked).not.toContain('click');
  });

  it('offers an unknown kind nothing', () => {
    expect(pickAskToolList([{ name: 'owa_read_website' }], 'nope')).toEqual([]);
  });
});
