import {
    genNextArchiveFilePath,
    toArchiveFileName,
} from '../helper/archiveNameHelpers';
import { handleError } from '../helper/errorHelpers';
import {
    checkIsRtl,
    DEFAULT_LANG_CODE,
    getLangDataByCodeAsync,
    initAllLangCss,
} from '../lang/langHelpers';
import { createOfficeFileSink } from '../ms-office/officeFileSinkHelpers';
import { OfficeZipWriter } from '../ms-office/officeZipHelpers';
import {
    fsDeleteFile,
    getDownloadPath,
    pathBasename,
} from '../server/fileHelpers';
import type {
    WordPageSnapshotType,
    WordPlacedPictureType,
    WordTextLangPickerType,
    WordTextLangType,
} from './markdownWordHelpers';
import {
    genWordContentTypesXml,
    genWordCorePropsXml,
    genWordDocumentRelsXml,
    genWordDocumentXml,
    genWordNumberingXml,
    genWordPackageRelsXml,
    genWordSettingsXml,
    genWordStylesXml,
    toWordContentBox,
} from './markdownWordHelpers';
import { genSvgFontCss, loadWordPicture } from './markdownWordMediaHelpers';

/**
 * Writing the Word document of a Markdown Preview page
 * (`markdownWordHelpers.ts`) into Downloads, as the app's other exports do,
 * named after the markdown file. Streamed: each picture goes into the file
 * as it is loaded, and the document's text, which needs to know which
 * pictures went in, last. Imported only when Word is pressed.
 */

export const WORD_DOT_EXTENSION = '.docx';

/**
 * The installed languages that write their words in a face of their own or
 * right to left, each asked by its own script facts which text is its; a
 * text none of them claims is written in the document's own face. Only those
 * with something to say are read, once per export.
 */
export async function genWordTextLangPicker(): Promise<WordTextLangPickerType> {
    let fontDataList: Awaited<ReturnType<typeof initAllLangCss>> = [];
    try {
        fontDataList = await initAllLangCss();
    } catch (error) {
        handleError(error);
    }
    const entryList: (WordTextLangType & {
        checkIsThisLang: (text: string) => boolean;
    })[] = [];
    for (const fontData of fontDataList) {
        if (fontData.langCode === DEFAULT_LANG_CODE) {
            continue;
        }
        const langData = await getLangDataByCodeAsync(fontData.langCode).catch(
            (error) => {
                handleError(error);
                return null;
            },
        );
        if (langData === null) {
            continue;
        }
        const isRtl = checkIsRtl(langData.locale);
        const fontFamily = fontData.globalFontFamily ?? null;
        if (fontFamily === null && !isRtl) {
            continue;
        }
        entryList.push({
            checkIsThisLang: langData.checkIsThisLang,
            fontFamily,
            isRtl,
        });
    }
    return (text) => {
        const entry = entryList.find((item) => {
            return item.checkIsThisLang(text);
        });
        return entry === undefined
            ? null
            : { fontFamily: entry.fontFamily, isRtl: entry.isRtl };
    };
}

function toDocumentName(markdownFilePath: string) {
    const fileName = pathBasename(markdownFilePath);
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

async function writeWordPackage(
    zipWriter: OfficeZipWriter,
    snapshot: WordPageSnapshotType,
    title: string,
) {
    // `[Content_Types].xml` first, as every Office package has it.
    await zipWriter.addEntry('[Content_Types].xml', genWordContentTypesXml());
    await zipWriter.addEntry('_rels/.rels', genWordPackageRelsXml());
    await zipWriter.addEntry('docProps/core.xml', genWordCorePropsXml(title));
    await zipWriter.addEntry('word/styles.xml', genWordStylesXml());
    await zipWriter.addEntry('word/settings.xml', genWordSettingsXml());
    await zipWriter.addEntry(
        'word/numbering.xml',
        genWordNumberingXml(snapshot.lists),
    );
    const svgTextList = snapshot.pictures.flatMap((picture) => {
        return picture.source.kind === 'svg' ? [picture.source.svgText] : [];
    });
    const loadContext = {
        maxBox: toWordContentBox(snapshot.pageSize),
        svgFontCss: await genSvgFontCss(svgTextList),
    };
    const placedList: WordPlacedPictureType[] = [];
    for (const [index, picture] of snapshot.pictures.entries()) {
        const loaded = await loadWordPicture(picture.source, loadContext).catch(
            (error) => {
                handleError(error);
                return null;
            },
        );
        if (loaded === null) {
            placedList.push(null);
            continue;
        }
        const fileName = `image${index + 1}.${loaded.extension}`;
        // Pictures are compressed already.
        await zipWriter.addEntry(`word/media/${fileName}`, loaded.bytes, {
            isCompressible: false,
        });
        placedList.push({
            fileName,
            width: loaded.width,
            height: loaded.height,
        });
    }
    await zipWriter.addEntry(
        'word/document.xml',
        genWordDocumentXml(snapshot, placedList),
    );
    await zipWriter.addEntry(
        'word/_rels/document.xml.rels',
        genWordDocumentRelsXml(snapshot, placedList),
    );
    await zipWriter.finish();
}

/**
 * Writes the document beside the person's other downloads, never over one
 * already there (`<name> (1).docx`), and returns its path. A file half
 * written is deleted.
 */
export async function exportMarkdownWordFile(
    snapshot: WordPageSnapshotType,
    markdownFilePath: string,
) {
    const title = toDocumentName(markdownFilePath);
    const filePath = await genNextArchiveFilePath(
        getDownloadPath(),
        toArchiveFileName(title, WORD_DOT_EXTENSION, 'Document'),
        WORD_DOT_EXTENSION,
    );
    const sink = createOfficeFileSink(filePath);
    let isWritten = false;
    try {
        await writeWordPackage(
            new OfficeZipWriter(sink.write),
            snapshot,
            title,
        );
        await sink.close();
        isWritten = true;
    } finally {
        if (!isWritten) {
            sink.abort();
            await fsDeleteFile(filePath).catch(handleError);
        }
    }
    return filePath;
}
