import type LyricAppDocument from './LyricAppDocument';
import { tran } from '../lang/langHelpers';

export type LyricStageDocumentEntryType = readonly [number, LyricAppDocument];

/**
 * Exports every stage currently shown in the lyric Stage Previewer.
 *
 * The PPTX writer stays behind the press so opening a lyric never loads the
 * Office package writer. Each stage gets a distinct, readable file name.
 */
export async function exportLyricStagesToPptx(
    entries: readonly LyricStageDocumentEntryType[],
) {
    const { exportAppDocumentsToPptx } =
        await import('../ms-office/pptxExportHelpers');
    return await exportAppDocumentsToPptx(
        entries.map(([stage, appDocument]) => {
            return {
                appDocument,
                name: `${appDocument.fileSource.name} - ${tran(
                    'Stage',
                )} ${stage}`,
            };
        }),
    );
}
