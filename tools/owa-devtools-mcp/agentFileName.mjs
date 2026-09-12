// Whether a name an agent chose may become a file in the user's Documents
// folder.
//
// Plain ESM with no `node:fs`, so the renderer bundles the module the server
// runs -- the same reason `botFocus.mjs` and `questionMatch.mjs` live here.
// BOTH layers of `owa_lyric_file` / `owa_slide_file` read it:
//
//  - `owaTools.mjs` checks it FIRST, before anything else, so a bad name is
//    answered as a bad name. It used to reach the content validator first,
//    which told a caller its song was malformed when the real complaint was
//    the path in the name -- a true sentence about the wrong thing.
//  - `src/helper/agentFileHelpers.ts` checks it again at the disk boundary,
//    because that is what actually writes and a check further out is one a
//    later caller can forget.
//
// It matters because nothing downstream is looking: `createNewFileDetail` in
// `src/server/fileHelpers.ts` still carries a `// TODO: verify file name
// before create`, so a separator or a `..` lands wherever it points.

// Reserved on Windows whatever the extension, so such a file can be neither
// created nor opened. Refusing early beats the failure that would follow.
const RESERVED_NAME_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const NAME_MAX_LENGTH = 120;

/**
 * The characters a file name may not carry.
 *
 * A list rather than a regular expression so no escaping question arises about
 * the backslash -- which is the one that matters most, being the path
 * separator on this app's main platform.
 */
export const UNSAFE_NAME_CHARACTERS = [
    '<',
    '>',
    ':',
    '"',
    '/',
    '\\',
    '|',
    '?',
    '*',
];

function checkHasControlCharacter(text) {
    for (const character of text) {
        if (character.charCodeAt(0) < 32) {
            return true;
        }
    }
    return false;
}

/**
 * The reason this name will not be written, or null when it is fine.
 *
 * Deliberately a REFUSAL rather than the sanitiser
 * `publicDomainSongsHelpers.sanitizeFileName` uses. That one cleans a title a
 * human picked out of a catalogue, where landing near the asked-for name is
 * the helpful thing. Here the caller is a language model naming a file on
 * somebody's disk, and the difference between "wrote what you asked for" and
 * "wrote something else" has to be visible.
 */
export function checkAgentFileName(name) {
    if (typeof name !== 'string' || name.trim() === '') {
        return 'Give the file a name.';
    }
    const trimmed = name.trim();
    if (trimmed.length > NAME_MAX_LENGTH) {
        return `That name is longer than ${NAME_MAX_LENGTH} characters.`;
    }
    const found = UNSAFE_NAME_CHARACTERS.find((one) => {
        return trimmed.includes(one);
    });
    if (found !== undefined || checkHasControlCharacter(trimmed)) {
        return (
            'A name cannot contain any of ' +
            UNSAFE_NAME_CHARACTERS.join(' ') +
            ' -- use plain words, the way it should read in the list.'
        );
    }
    if (trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
        return 'A name cannot start with a dot.';
    }
    if (trimmed.endsWith('.')) {
        return 'A name cannot end with a dot.';
    }
    if (RESERVED_NAME_PATTERN.test(trimmed)) {
        return `"${trimmed}" is a name this computer reserves for itself.`;
    }
    return null;
}
