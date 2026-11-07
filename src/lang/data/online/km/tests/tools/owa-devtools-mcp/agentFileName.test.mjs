// The Khmer cases of `tools/owa-devtools-mcp/agentFileName.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, it } from 'vitest';

import { checkAgentFileName } from '../../../../../../../../tools/owa-devtools-mcp/agentFileName.mjs';

// The name rules are the containment half of these tools' safety, and they are
// the half a unit test can hold on its own. Both the tool and the app's disk
// boundary use this module to refuse unsafe names before doing any work.
describe('checkAgentFileName', () => {
    it('takes an ordinary song name', () => {
        for (const name of [
            'Amazing Grace',
            'Blessed Assurance (2)',
            'song 159 old - offering',
            'ទ្រង់មានចេស្តា',
            '10,000 Reasons',
        ]) {
            expect(checkAgentFileName(name), name).toBeNull();
        }
    });
});
