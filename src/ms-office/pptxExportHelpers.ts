// "Export to PPTX" for a slide document. Loaded only when the menu item is
// pressed (see `VaryAppDocumentFileComp`).
//
// The package is streamed straight into Downloads: every part is written the
// moment it exists, pictures the first time a slide uses them, so memory holds
// one slide's DOM and one picture at a time however long the document is.

import type AppDocument from '../app-document-list/AppDocument';
import {
    fsCreateWriteStream,
    fsDeleteFile,
    getDownloadPath,
} from '../server/fileHelpers';
import {
    genNextArchiveFilePath,
    toArchiveFileName,
} from '../helper/archiveNameHelpers';
import { handleError } from '../helper/errorHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import {
    hideProgressBar,
    showProgressBar,
    showProgressBarMessage,
} from '../progress-bar/progressBarHelpers';
import appProvider from '../server/appProvider';
import { OfficeZipWriter } from './officeZipHelpers';
import type {
    PptxDeckInfoType,
    PptxMediaType,
    PptxSlideRelsType,
} from './pptxXmlHelpers';
import {
    genAppPropsXml,
    genContentTypesXml,
    genCorePropsXml,
    genNotesMasterRelsXml,
    genNotesMasterXml,
    genNotesSlideRelsXml,
    genNotesSlideXml,
    genPptxSlideSize,
    genPptxUnits,
    genPresPropsXml,
    genPresentationRelsXml,
    genPresentationXml,
    genRootRelsXml,
    genSlideLayoutRelsXml,
    genSlideLayoutXml,
    genSlideMasterRelsXml,
    genSlideMasterXml,
    genSlideRelsXml,
    genSlideXml,
    genTableStylesXml,
    genThemeXml,
    genViewPropsXml,
} from './pptxXmlHelpers';
import type { PptxMediaLoadedType } from './pptxSlideMeasureHelpers';
import { PptxSlideMeasurer } from './pptxSlideMeasureHelpers';

export const PPTX_DOT_EXTENSION = '.pptx';
const EXPORT_TITLE = 'Export to PPTX';

function createFileSink(filePath: string) {
    const stream = fsCreateWriteStream(filePath);
    let streamError: Error | null = null;
    stream.on('error', (error) => {
        streamError = error;
    });
    return {
        write: (chunk: Uint8Array) => {
            return new Promise<void>((resolve, reject) => {
                if (streamError !== null) {
                    reject(streamError);
                    return;
                }
                // one entry per call and each awaited: backpressure for free
                stream.write(chunk, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        },
        close: () => {
            return new Promise<void>((resolve, reject) => {
                if (streamError !== null) {
                    reject(streamError);
                    return;
                }
                stream.once('error', reject);
                stream.end(() => {
                    resolve();
                });
            });
        },
        abort: () => {
            stream.destroy();
        },
    };
}

// Pictures by source: a background every slide shares is written once.
class PptxMediaStore {
    private readonly fileNameMap = new Map<string, string>();
    private readonly zipWriter: OfficeZipWriter;

    constructor(zipWriter: OfficeZipWriter) {
        this.zipWriter = zipWriter;
    }

    async add(
        key: string,
        load: () => Promise<PptxMediaLoadedType | null>,
    ): Promise<PptxMediaType | null> {
        const knownFileName = this.fileNameMap.get(key);
        if (knownFileName !== undefined) {
            return { fileName: knownFileName };
        }
        const loaded = await load();
        if (loaded === null) {
            return null;
        }
        const fileName = `image${this.fileNameMap.size + 1}.${loaded.extension}`;
        await this.zipWriter.addEntry(`ppt/media/${fileName}`, loaded.bytes, {
            isCompressible: false,
        });
        this.fileNameMap.set(key, fileName);
        return { fileName };
    }
}

async function writePackage(
    appDocument: AppDocument,
    zipWriter: OfficeZipWriter,
) {
    const slides = await appDocument.getSlides();
    const [firstSlide] = slides;
    const deck = genPptxSlideSize(
        firstSlide?.width ?? 1920,
        firstSlide?.height ?? 1080,
    );
    const notesSlideIndexes = slides
        .map((slide, index) => {
            return slide.note.trim() === '' ? null : index + 1;
        })
        .filter((index) => {
            return index !== null;
        });
    const info: PptxDeckInfoType = {
        title: appDocument.fileSource.name,
        slideCount: slides.length,
        notesSlideIndexes,
        hiddenSlideCount: slides.filter((slide) => {
            return slide.isDisabled;
        }).length,
        widthEmu: deck.widthEmu,
        heightEmu: deck.heightEmu,
        createdAt: new Date(),
        applicationName: appProvider.appInfo.title,
    };
    // `[Content_Types].xml` first: nothing requires it, but some readers
    // expect it and it costs nothing
    const fixedPartList: [string, string][] = [
        ['[Content_Types].xml', genContentTypesXml(info)],
        ['_rels/.rels', genRootRelsXml()],
        ['docProps/core.xml', genCorePropsXml(info)],
        ['docProps/app.xml', genAppPropsXml(info)],
        ['ppt/presentation.xml', genPresentationXml(info)],
        ['ppt/_rels/presentation.xml.rels', genPresentationRelsXml(info)],
        ['ppt/slideMasters/slideMaster1.xml', genSlideMasterXml()],
        [
            'ppt/slideMasters/_rels/slideMaster1.xml.rels',
            genSlideMasterRelsXml(),
        ],
        ['ppt/slideLayouts/slideLayout1.xml', genSlideLayoutXml()],
        [
            'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
            genSlideLayoutRelsXml(),
        ],
        ['ppt/theme/theme1.xml', genThemeXml(info.applicationName)],
        ['ppt/presProps.xml', genPresPropsXml()],
        ['ppt/viewProps.xml', genViewPropsXml()],
        ['ppt/tableStyles.xml', genTableStylesXml()],
    ];
    if (notesSlideIndexes.length > 0) {
        fixedPartList.push(
            ['ppt/notesMasters/notesMaster1.xml', genNotesMasterXml()],
            [
                'ppt/notesMasters/_rels/notesMaster1.xml.rels',
                genNotesMasterRelsXml(),
            ],
            ['ppt/theme/theme2.xml', genThemeXml(info.applicationName)],
        );
    }
    for (const [fileName, text] of fixedPartList) {
        await zipWriter.addEntry(fileName, text);
    }
    const mediaStore = new PptxMediaStore(zipWriter);
    const measurer = new PptxSlideMeasurer((key, load) => {
        return mediaStore.add(key, load);
    });
    try {
        await measurer.init();
        for (const [index, slide] of slides.entries()) {
            const slideIndex = index + 1;
            showProgressBarMessage(
                tran(EXPORT_TITLE),
                `${slideIndex}/${slides.length}`,
            );
            const model = await measurer.measureSlide(slide);
            const units = genPptxUnits(deck, slide.width, slide.height);
            const hasNote = notesSlideIndexes.includes(slideIndex);
            const rels: PptxSlideRelsType = {
                mediaRelationshipMap: new Map(),
                notesSlideIndex: hasNote ? slideIndex : null,
            };
            const slideXml = genSlideXml(model, units, rels);
            await zipWriter.addEntry(
                `ppt/slides/slide${slideIndex}.xml`,
                slideXml,
            );
            await zipWriter.addEntry(
                `ppt/slides/_rels/slide${slideIndex}.xml.rels`,
                genSlideRelsXml(rels),
            );
            if (hasNote) {
                await zipWriter.addEntry(
                    `ppt/notesSlides/notesSlide${slideIndex}.xml`,
                    genNotesSlideXml(model.note),
                );
                await zipWriter.addEntry(
                    `ppt/notesSlides/_rels/notesSlide${slideIndex}.xml.rels`,
                    genNotesSlideRelsXml(slideIndex),
                );
            }
        }
    } finally {
        measurer.destroy();
    }
    await zipWriter.finish();
}

export async function exportAppDocumentToPptx(appDocument: AppDocument) {
    showProgressBar(EXPORT_TITLE);
    let filePath: string | null = null;
    let sink: ReturnType<typeof createFileSink> | null = null;
    try {
        filePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toArchiveFileName(
                appDocument.fileSource.name,
                PPTX_DOT_EXTENSION,
                'Document',
            ),
            PPTX_DOT_EXTENSION,
        );
        sink = createFileSink(filePath);
        const { write } = sink;
        await writePackage(appDocument, new OfficeZipWriter(write));
        await sink.close();
        // `showSimpleToast` does not translate; the path goes on AFTER the
        // translation, never into the key.
        showSimpleToast(
            tran(EXPORT_TITLE),
            `${tran('Exported to')} ${filePath}`,
        );
        showFileOrDirExplorer(filePath);
        return filePath;
    } catch (error) {
        handleError(error);
        sink?.abort();
        if (filePath !== null) {
            // never leave half a package behind looking like a real one
            await fsDeleteFile(filePath).catch(handleError);
        }
        showSimpleToast(
            tran(EXPORT_TITLE),
            tran('Unable to export the document to PPTX'),
        );
        return null;
    } finally {
        hideProgressBar(EXPORT_TITLE);
    }
}
