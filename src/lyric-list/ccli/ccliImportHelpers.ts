/**
 * CCLI Song Import Helpers
 * 
 * Utilities for importing CCLI songs as lyrics with proper
 * metadata and formatting.
 */

import { CCLISongType, CCLIImportOptionsType, CCLILyricMetadataType } from './ccliTypes';
import Lyric from '../Lyric';
import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
import { fsCheckFileExist } from '../../server/fileHelpers';

const MAX_FILENAME_ATTEMPTS = 1000;

function toStringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

/**
 * Convert CCLI song to lyric content format
 */
function formatCCLISongAsLyric(
    song: CCLISongType,
    _options: CCLIImportOptionsType = {},
): string {
    // Options for future enhancement (chords, formatting)
    // const { includeChords = true, autoFormat = true } = _options;

    let content = song.lyrics || '';

    // If no lyrics provided, create a placeholder
    if (!content) {
        content = `---
# ${song.title}
---
c1:
l1: (Lyrics not available)
l1: Please add lyrics manually or contact CCLI support.
`;
    }

    // Add header comment with song info
    const header = `# ${song.title}
# Author: ${song.author}
# CCLI Number: ${song.ccliNumber}
# Copyright: ${song.copyright}
${song.publisher ? `# Publisher: ${song.publisher}` : ''}
# Imported from CCLI SongSelect

`;

    return header + content;
}

/**
 * Create CCLI metadata for lyric
 */
function createCCLIMetadata(song: CCLISongType): CCLILyricMetadataType {
    return {
        ccliNumber: song.ccliNumber,
        ccliSongId: song.songId,
        title: song.title,
        author: song.author,
        copyright: song.copyright,
        publisher: song.publisher,
        importDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
    };
}

/**
 * Generate a safe filename from song title
 */
function sanitizeFilename(title: string): string {
    return title
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .toLowerCase()
        .substring(0, 100); // Limit length
}

/**
 * Import a CCLI song as a lyric file
 */
export async function importCCLISongAsLyric(
    song: CCLISongType,
    dirPath: string,
    options: CCLIImportOptionsType = {},
): Promise<boolean> {
    try {
        // Generate filename
        const baseName = sanitizeFilename(song.title);
        let fileName = baseName;
        let counter = 1;

        // Check if file exists and generate unique name
        while (true) {
            const filePath = FileSource.getInstance(dirPath, fileName).filePath;
            const exists = await fsCheckFileExist(filePath);
            if (!exists) {
                break;
            }
            fileName = `${baseName}-${counter}`;
            counter++;

            if (counter > MAX_FILENAME_ATTEMPTS) {
                throw new Error(
                    `Unable to generate unique lyric filename for "${song.title}" after ${MAX_FILENAME_ATTEMPTS} attempts`,
                );
            }
        }

        // Format lyrics content
        const content = formatCCLISongAsLyric(song, options);

        // Create lyric file
        const created = await Lyric.create(dirPath, fileName);
        
        if (!created) {
            return false;
        }

        // Get the lyric instance
        const lyricPath = FileSource.getInstance(dirPath, fileName).filePath;
        const lyric = Lyric.getInstance(lyricPath);

        // Set content
        await lyric.setContent(content);

        // Update metadata with CCLI info
        const metadata = await lyric.getMetadata();
        const ccliMetadata = createCCLIMetadata(song);
        
        const jsonData = await lyric.getJsonData();
        if (jsonData) {
            jsonData.metadata = {
                ...metadata,
                ...ccliMetadata,
            };
            await lyric.setJsonData(jsonData);
        }

        await lyric.save();

        return true;
    } catch (error) {
        handleError(error);
        return false;
    }
}

/**
 * Extract CCLI metadata from lyric
 */
export async function getCCLIMetadataFromLyric(
    lyric: Lyric,
): Promise<CCLILyricMetadataType | null> {
    try {
        const metadata = await lyric.getMetadata();

        if (metadata === null || typeof metadata !== 'object') {
            return null;
        }

        const record = metadata as Record<string, unknown>;
        const hasAnyCcli =
            typeof record.ccliNumber === 'string' || typeof record.ccliSongId === 'string';

        // Check if this lyric has CCLI metadata
        if (hasAnyCcli) {
            return {
                ccliNumber: toStringOrUndefined(record.ccliNumber),
                ccliSongId: toStringOrUndefined(record.ccliSongId),
                title: toStringOrUndefined(record.title),
                author: toStringOrUndefined(record.author),
                copyright: toStringOrUndefined(record.copyright),
                publisher: toStringOrUndefined(record.publisher),
                importDate: toStringOrUndefined(record.importDate),
                lastModified: toStringOrUndefined(record.lastModified),
            };
        }
        
        return null;
    } catch (error) {
        handleError(error);
        return null;
    }
}

/**
 * Check if a lyric was imported from CCLI
 */
export async function isFromCCLI(lyric: Lyric): Promise<boolean> {
    const ccliMetadata = await getCCLIMetadataFromLyric(lyric);
    return ccliMetadata !== null && !!ccliMetadata.ccliNumber;
}
