import { beforeEach, describe, expect, test, vi } from 'vitest';

// A stand-in for the app's own validator with the two rules this check has
// to get right: the document metadata needs an `initDate`, and a slide needs
// an `id`.
const validateMock = vi.hoisted(() => {
    return vi.fn((json: any) => {
        if (typeof json.metadata?.initDate !== 'string') {
            throw new Error('Invalid data');
        }
        for (const item of json.items) {
            if (typeof item.id !== 'number') {
                throw new Error(
                    `Invalid slide data json:${JSON.stringify(item)}`,
                );
            }
        }
    });
});

vi.mock('../app-document-list/AppDocument', () => ({
    default: { validate: validateMock },
}));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('./DirSource', () => ({ default: {} }));
vi.mock('./constants', () => ({ dirSourceSettingNames: {} }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(),
    fsListFilesWithMimetype: vi.fn(),
    getMimetypeExtensions: vi.fn(),
    pathJoin: vi.fn(),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: vi.fn(),
    genUndoField: vi.fn(),
    renameAgentFile: vi.fn(),
    runWithAgentBackup: vi.fn(),
    snapshotAgentEditing: vi.fn(),
    snapshotAgentFileForDelete: vi.fn(),
    trashAgentFile: vi.fn(),
}));
vi.mock('./agentSlideHelpers', () => ({
    applyAgentSlideAction: vi.fn(),
    checkIsAgentSlideAction: vi.fn(),
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));

import { AGENT_FILE_KIND_MAP } from './agentFileHelpers';

const checkContent = AGENT_FILE_KIND_MAP.slide.checkContent;

describe('slide document content check', () => {
    beforeEach(() => {
        validateMock.mockClear();
    });

    test('does not judge a partial document metadata it never writes', async () => {
        const content = JSON.stringify({
            metadata: { app: 'OpenWorship', fileVersion: 1 },
            items: [{ id: 1, canvasItems: [] }],
        });

        expect(await checkContent(content)).toBeNull();
    });

    test('names the slide the app refused', async () => {
        const content = JSON.stringify({
            items: [{ id: 1, canvasItems: [] }, { canvasItems: [] }],
        });

        const refusal = await checkContent(content);

        expect(refusal).toMatch(/^This app refused that document at slide 2: /);
    });

    test('still explains a missing items array before validating', async () => {
        expect(await checkContent('{"metadata":{}}')).toMatch(
            /There is no `items` array/,
        );
        expect(validateMock).not.toHaveBeenCalled();
    });
});
