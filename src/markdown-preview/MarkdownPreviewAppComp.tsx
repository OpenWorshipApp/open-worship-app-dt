import './MarkdownPreviewAppComp.scss';

import type { CSSProperties, MouseEvent } from 'react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppEffectAsync,
} from '../helper/appHooks';
import { genBlockUnload } from '../helper/blockUnloadHelpers';
import { handleError } from '../helper/errorHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { initAllLangCss, tran } from '../lang/langHelpers';
import { keepThemeWhilePrinting, useThemeSource } from '../others/themeHelpers';
import ScrollToTopComp from '../scrolling/ScrollToTopComp';
import { printHtmlText, showFileOrDirExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { pathBasename } from '../server/fileHelpers';
import type { MarkdownHeadingListType } from './markdownHeadingHelpers';
import {
    checkHasMarkdownHeadings,
    readMarkdownHeadings,
    scrollToMarkdownHeading,
} from './markdownHeadingHelpers';
import MarkdownHeadingListComp from './MarkdownHeadingListComp';
import {
    checkHasUndrawnDiagrams,
    putBackDrawnDiagrams,
    renderMermaidDiagrams,
    takeDrawnDiagrams,
} from './markdownMermaidHelpers';
import type {
    PrintAppendixLabelsType,
    PrintAppendixType,
    PrintReferencesType,
} from './markdownPrintAppendixHelpers';
import {
    drawLightDiagramsForPrint,
    loadPicturesForPrint,
    registerPrintPreparation,
    removePrintAppendix,
} from './markdownPrintHelpers';
import {
    loadMarkdownPreviewFile,
    type MarkdownPreviewLoadResultType,
    readMarkdownPreviewText,
    renderMarkdownPreviewText,
    saveMarkdownPreviewFile,
    toMarkdownPreviewTargetPath,
} from './markdownPreviewFileHelpers';
import {
    getMarkdownPreviewFilePath,
    MARKDOWN_REF_CLASS,
} from './markdownPreviewParamHelpers';
import {
    classifyMarkdownHref,
    toHeadingElementId,
} from './markdownPreviewRenderHelpers';
import MarkdownPreviewChatbotButtonComp from './MarkdownPreviewChatbotButtonComp';
import MarkdownPrintAskComp, {
    type MarkdownPrintAnswerType,
} from './MarkdownPrintAskComp';

// Monaco is the heaviest thing this window could load, and most windows are
// only read: it comes in the first time Edit is pressed, never before.
const LazyMarkdownPreviewEditorComp = lazy(() => {
    return import('./MarkdownPreviewEditorComp');
});

// Long enough to read two sentences; the bar is a note, not a question.
const WARNING_SHOW_MILLISECONDS = 6000;

// The preview beside the editor is drawn again once typing pauses this long,
// not on every key: a render is the whole page, diagrams included.
const DRAFT_PREVIEW_MILLISECONDS = 500;

// Printing. Main asks the page to get ready again as the head row's Print
// sends the print it has just got ready: within this, the page still is.
const PREPARED_PRINT_MILLISECONDS = 10_000;
// A diagram that has not drawn by then goes on paper as it stands: main waits
// as long as the person takes to answer, so the page bounds its own waits.
const PRINT_DIAGRAM_WAIT_MILLISECONDS = 10_000;
// So with the last words typed, drawn into the page for a print, the page's
// verses, people and places being made links, and its pictures not fetched
// yet (`loadPicturesForPrint`).
const PRINT_PAGE_WAIT_MILLISECONDS = 10_000;
// A question nobody answers is a Cancel, never a print hours later.
const PRINT_ASK_MILLISECONDS = 5 * 60_000;
// A page got ready for paper stays as it is until the paper is made
// (`afterprint`); one main never prints is let go after this.
const PRINT_HOLD_MILLISECONDS = 10_000;

const STATUS_MESSAGE_MAP: Record<
    Exclude<MarkdownPreviewLoadResultType['status'], 'ready' | 'loading'>,
    string
> = {
    'not-found': 'File not found',
    'too-large': 'This file is too large to preview',
    unreadable: 'Cannot read this file',
};

/**
 * The fonts of every language the app ships, after the UI's own: a markdown
 * file from a congregation's shared folder is as likely to be in its own
 * language as in English, whatever language the app itself is shown in, and a
 * system font with no glyphs for that script would draw it as boxes.
 *
 * Null until they are read (an empty list when they cannot be): the diagrams
 * wait for them, since mermaid measures its labels in the face it is given.
 */
function useLangFontFamilies() {
    const [langFontFamilies, setLangFontFamilies] = useState<string | null>(
        null,
    );
    useAppEffectAsync(
        async (methodContext) => {
            let langDataList: Awaited<ReturnType<typeof initAllLangCss>>;
            try {
                langDataList = await initAllLangCss();
            } catch (error) {
                methodContext.setLangFontFamilies('');
                throw error;
            }
            methodContext.setLangFontFamilies(
                langDataList
                    .map((langData) => {
                        return langData.fontFamily;
                    })
                    .filter((fontFamily) => {
                        return !!fontFamily;
                    })
                    .join(', '),
            );
        },
        [],
        { setLangFontFamilies },
    );
    return langFontFamilies;
}

/**
 * A person, place, verse or file pressed on the page. Its helpers are
 * already loaded -- they made the link -- so the import costs nothing.
 * A press that ends a drag-selection is someone selecting words, as in the
 * Reader's verses.
 */
async function openPressedReference(element: Element) {
    const { findMarkdownRef, openResourceFileWindow } =
        await import('./markdownPreviewReferenceHelpers');
    const ref = findMarkdownRef(element);
    if (ref === null) {
        return;
    }
    if (ref.kind === 'file') {
        await openResourceFileWindow(ref.filePath);
        return;
    }
    const { requestDetailPanelInReader } =
        await import('../location-name-lookup/detailPanelRequestHelpers');
    requestDetailPanelInReader(ref.request);
}

async function openLinkedFile(filePath: string) {
    const { openResourceFileWindow } =
        await import('./markdownPreviewReferenceHelpers');
    await openResourceFileWindow(filePath);
}

/**
 * The verses, people and places the page links, for the question before a
 * print -- null, with nothing imported, for a page that links none.
 */
async function collectPageReferences(articleElement: HTMLElement) {
    if (articleElement.querySelector(`.${MARKDOWN_REF_CLASS}`) === null) {
        return null;
    }
    const { collectPrintReferences, countPrintReferences } =
        await import('./markdownPrintAppendixHelpers');
    const references = collectPrintReferences(articleElement);
    return countPrintReferences(references) > 0 ? references : null;
}

/**
 * Their Bible text and details, read once the person asked for them; null
 * when they could not be read, and the page is printed without them.
 */
async function readPageReferences(references: PrintReferencesType) {
    try {
        const { readPrintAppendix } =
            await import('./markdownPrintAppendixReadHelpers');
        return await readPrintAppendix(references);
    } catch (error) {
        handleError(error);
        return null;
    }
}

function genPrintAppendixLabels(): PrintAppendixLabelsType {
    return {
        verses: tran('Verses'),
        names: tran('Names'),
        places: tran('Places'),
        modernIdentification: tran('Modern identification'),
        leftOut: tran('{count} more could not be added.'),
    };
}

/** `promise`, or `milliseconds` -- whichever is first; never a throw. */
async function waitAtMost(promise: Promise<unknown>, milliseconds: number) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            promise.catch(handleError),
            new Promise<void>((resolve) => {
                timeout = setTimeout(resolve, milliseconds);
            }),
        ]);
    } finally {
        clearTimeout(timeout);
    }
}

async function decoratePageReferences(
    articleElement: HTMLElement,
    filePath: string,
    checkIsStale: () => boolean,
) {
    const { decorateMarkdownReferences } =
        await import('./markdownPreviewReferenceHelpers');
    if (!checkIsStale()) {
        await decorateMarkdownReferences(
            articleElement,
            filePath,
            checkIsStale,
        );
    }
}

function genUnsavedWarningText(isLeaving: boolean) {
    const text =
        `${tran('Unsaved changes')}: ` +
        tran('Please save or discard them before reloading.');
    return isLeaving
        ? `${text} ${tran('Or attempt 3 times to force leaving.')}`
        : text;
}

function checkIsSaveKeyEvent(event: KeyboardEvent) {
    return (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 's'
    );
}

export default function MarkdownPreviewAppComp() {
    const { theme } = useThemeSource();
    const langFontFamilies = useLangFontFamilies();
    // One file for the window's whole life: a file a link names opens in a
    // window of its own (2026-11-11, the user's _own window for every type_).
    const [filePath] = useState<string | null>(() => {
        return getMarkdownPreviewFilePath(globalThis.location.href);
    });
    const [reloadCount, setReloadCount] = useState(0);
    const [loadResult, setLoadResult] = useState<MarkdownPreviewLoadResultType>(
        { status: 'loading' },
    );
    // Editing. The text itself is kept in refs, not state: a keystroke must
    // not re-render the window, only the moment it becomes (un)saved does.
    // Both are null while there is nothing being edited, so a file that was
    // only read holds no second copy of itself.
    const [isEditing, setIsEditing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [editorText, setEditorText] = useState('');
    const [editorKey, setEditorKey] = useState(0);
    const [warningText, setWarningText] = useState('');
    const savedTextRef = useRef<string | null>(null);
    const draftTextRef = useRef<string | null>(null);
    const isSavingRef = useRef(false);
    // Set by the Edit press, which has just read the file itself.
    const isEditReadSkippedRef = useRef(false);
    const articleRef = useRef<HTMLDivElement>(null);
    // The page beside the editor, which scrolls by itself.
    const pageRef = useRef<HTMLDivElement>(null);
    // What the diagrams on the page were drawn from, so the next render of it
    // can keep the ones that did not change. Only the sources of the result
    // on screen, which that result holds anyway.
    const drawnDiagramsRef = useRef<{
        sources: string[];
        isDark: boolean;
        langFontFamilies: string;
    } | null>(null);
    // The diagrams' drawing on the page now, which a print waits for.
    const diagramPassRef = useRef<{
        promise: Promise<void>;
        sources: string[];
        isDark: boolean;
        checkIsStale: () => boolean;
    } | null>(null);
    // A print waiting for that drawing to start -- the diagrams wait for the
    // languages' faces -- told the moment it does.
    const diagramPassWaitRef = useRef<(() => void) | null>(null);
    // The page's verses, people and places being made links, which the
    // question before a print counts.
    const pageReferencesRef = useRef<Promise<void> | null>(null);
    // The typing is drawn into the page once it pauses: true while the last
    // words typed are not on it yet, which a print draws first -- and the
    // render it drew, which tells it once it is on the page.
    const isDraftDrawPendingRef = useRef(false);
    const printDrawRef = useRef<{
        loadResult: MarkdownPreviewLoadResultType;
        resolve: () => void;
    } | null>(null);
    // A print takes the page as it was got ready for paper: from the moment
    // one is asked for until the paper is made, the page is not drawn again.
    // Drawn again in between, it loses what the print put in it -- the
    // diagrams' light pictures, the pictures fetched for paper, the appendix
    // -- and goes on paper half drawn. The last draw asked for meanwhile (a
    // pause in the typing, a save beside it, a reload) waits here and is
    // drawn once the print is done (`releasePageAfterPrint`).
    const printHoldRef = useRef<{
        heldLoadResult: MarkdownPreviewLoadResultType | null;
        timeout: ReturnType<typeof setTimeout> | null;
    } | null>(null);
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);
    // The question before a print of a page linking verses, people or
    // places, and how it is answered.
    const [printAsk, setPrintAsk] = useState<{
        references: PrintReferencesType;
        isReading: boolean;
    } | null>(null);
    const printAnswerRef = useRef<
        ((answer: MarkdownPrintAnswerType) => void) | null
    >(null);
    const isPreparingPrintRef = useRef(false);
    const preparedPrintAtRef = useRef(0);
    const filePathRef = useAppCurrentRef(filePath);
    const isEditingRef = useAppCurrentRef(isEditing);
    // The page's headings while the Sections list is open, and nothing while
    // it is closed (`markdownHeadingHelpers.ts`).
    const [headingList, setHeadingList] =
        useState<MarkdownHeadingListType | null>(null);
    const headingListRef = useAppCurrentRef(headingList);
    const headingToggleRef = useRef<HTMLButtonElement>(null);
    const hasHeadings = useMemo(() => {
        return (
            loadResult.status === 'ready' &&
            checkHasMarkdownHeadings(loadResult.html)
        );
    }, [loadResult]);

    const checkIsDraftUnsaved = useCallback(() => {
        return (
            draftTextRef.current !== null &&
            draftTextRef.current !== savedTextRef.current
        );
    }, []);

    const endEditSession = useCallback(() => {
        savedTextRef.current = null;
        draftTextRef.current = null;
        setIsDirty(false);
    }, []);

    const warningAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(WARNING_SHOW_MILLISECONDS);
    }, []);
    const showWarning = useCallback((text: string) => {
        setWarningText(text);
        warningAttemptTimeout(() => {
            setWarningText('');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Every draw of the page but a print's own: held while a print holds the
    // page, the last one drawn once it is done.
    const showLoadResult = useCallback(
        (newLoadResult: MarkdownPreviewLoadResultType) => {
            const printHold = printHoldRef.current;
            if (printHold !== null) {
                printHold.heldLoadResult = newLoadResult;
                return;
            }
            setLoadResult(newLoadResult);
        },
        [],
    );
    // The print is on paper, or never will be: the draw that waited for it
    // is drawn.
    const releasePageAfterPrint = useCallback(() => {
        const printHold = printHoldRef.current;
        if (printHold === null) {
            return;
        }
        printHoldRef.current = null;
        if (printHold.timeout !== null) {
            clearTimeout(printHold.timeout);
        }
        if (printHold.heldLoadResult !== null) {
            setLoadResult(printHold.heldLoadResult);
        }
    }, []);

    // The draft as a page, each block marked with the line it starts at: what
    // the page beside the editor and the editor read to follow each other's
    // scrolling (`markdownScrollFollowHelpers.ts`). A page only read is drawn
    // without them. Null with no draft to draw.
    const genDraftLoadResult = useCallback(() => {
        isDraftDrawPendingRef.current = false;
        const currentFilePath = filePathRef.current;
        const draftText = draftTextRef.current;
        if (currentFilePath === null || draftText === null) {
            return null;
        }
        return renderMarkdownPreviewText(currentFilePath, draftText, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const renderDraftPreview = useCallback(() => {
        const newLoadResult = genDraftLoadResult();
        if (newLoadResult !== null) {
            showLoadResult(newLoadResult);
        }
    }, [genDraftLoadResult, showLoadResult]);
    const draftPreviewAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(DRAFT_PREVIEW_MILLISECONDS);
    }, []);

    useAppEffect(() => {
        if (filePath === null) {
            setLoadResult({ status: 'not-found' });
            return;
        }
        let isCancelled = false;
        if (isEditing) {
            // The page beside the editor draws the DRAFT, so a change on disk
            // means a newer text for an editor that has nothing unsaved in
            // it: both take it. One with unsaved words is never overwritten
            // -- Save writes them over the file instead.
            if (isEditReadSkippedRef.current) {
                isEditReadSkippedRef.current = false;
                // The text the Edit press read, drawn again with its lines
                // marked, so the page follows the editor from the start.
                draftPreviewAttemptTimeout(renderDraftPreview, true);
                return;
            }
            readMarkdownPreviewText(filePath).then((textResult) => {
                if (
                    isCancelled ||
                    textResult.status !== 'ready' ||
                    checkIsDraftUnsaved() ||
                    textResult.text === savedTextRef.current
                ) {
                    return;
                }
                savedTextRef.current = textResult.text;
                draftTextRef.current = textResult.text;
                setEditorText(textResult.text);
                setEditorKey((key) => {
                    return key + 1;
                });
                // At once, and any draw still waiting on the typing is off.
                draftPreviewAttemptTimeout(renderDraftPreview, true);
            });
            return () => {
                isCancelled = true;
            };
        }
        if (checkIsDraftUnsaved() && draftTextRef.current !== null) {
            // What the person wrote and has not saved, drawn as it will be.
            showLoadResult(
                renderMarkdownPreviewText(filePath, draftTextRef.current),
            );
            return;
        }
        // A reload keeps what is on screen until the new render is ready, so
        // saving the file in an editor does not flash the page empty.
        loadMarkdownPreviewFile(filePath).then((newLoadResult) => {
            if (!isCancelled) {
                showLoadResult(newLoadResult);
            }
        });
        return () => {
            isCancelled = true;
        };
    }, [filePath, reloadCount, isEditing]);

    useAppEffect(() => {
        if (filePath === null) {
            return;
        }
        document.title =
            `${appProvider.windowTitle} - ${pathBasename(filePath)}` +
            (isDirty ? ' *' : '');
    }, [filePath, isDirty]);

    // Follows the file while the window is open, so a document being written
    // in an editor beside it shows each save. ONE watcher, on the one file on
    // screen, debounced: an editor's save is several events.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useAppEffect(() => {
        if (filePath === null) {
            return;
        }
        const abortController = new AbortController();
        try {
            const watcher = appProvider.fileUtils.watch(
                filePath,
                { signal: abortController.signal },
                () => {
                    attemptTimeout(() => {
                        setReloadCount((count) => {
                            return count + 1;
                        });
                    });
                },
            );
            // A file deleted or renamed away raises here; without a listener
            // that is an uncaught error. The reload the change event already
            // asked for is what shows "File not found".
            watcher.on('error', () => {});
        } catch {
            // A file that is not there cannot be watched. Reload still works.
        }
        return () => {
            abortController.abort();
        };
        // Re-armed after every reload: an editor that saves by writing a new
        // file and renaming it over the old one leaves a watcher on a file
        // that no longer exists.
    }, [filePath, reloadCount]);

    useAppEffect(() => {
        // A print that drew this render goes on once it is on the page.
        const resolvePrintDraw = () => {
            const printDraw = printDrawRef.current;
            if (printDraw !== null && printDraw.loadResult === loadResult) {
                printDrawRef.current = null;
                printDraw.resolve();
            }
        };
        const articleElement = articleRef.current;
        if (articleElement === null || loadResult.status !== 'ready') {
            pageReferencesRef.current = null;
            resolvePrintDraw();
            return;
        }
        const isDark = theme === 'dark';
        // A diagram already drawn from the same source, in the same theme and
        // faces, is kept rather than drawn again: the page beside the editor
        // is rendered again on every pause in the typing.
        const drawnDiagrams = drawnDiagramsRef.current;
        const drawnMap =
            drawnDiagrams !== null &&
            drawnDiagrams.isDark === isDark &&
            drawnDiagrams.langFontFamilies === langFontFamilies
                ? takeDrawnDiagrams(articleElement, drawnDiagrams.sources)
                : null;
        // The rendered file never goes through React: it is markdown-it's
        // output as the sanitizer left it, and the mermaid diagrams are swapped
        // into it in place afterwards, which React would undo on its next
        // render.
        articleElement.innerHTML = loadResult.html;
        if (drawnMap !== null) {
            putBackDrawnDiagrams(
                articleElement,
                loadResult.mermaidSources,
                drawnMap,
            );
        }
        let isStale = false;
        const checkIsStale = () => {
            return isStale;
        };
        const markStale = () => {
            isStale = true;
        };
        // The names, places, verses and files it mentions, made links once
        // what they read is ready; a page drawn again meanwhile is not
        // touched (`markdownPreviewReferenceHelpers.ts`).
        const currentFilePath = filePathRef.current;
        pageReferencesRef.current =
            currentFilePath === null
                ? null
                : decoratePageReferences(
                      articleElement,
                      currentFilePath,
                      checkIsStale,
                  ).catch(handleError);
        resolvePrintDraw();
        // The diagrams wait for the languages' faces: the page's words are
        // drawn at once, and redrawn into them by the browser, but a diagram
        // is laid out ONCE, in the faces its page names when it is drawn.
        if (langFontFamilies === null) {
            drawnDiagramsRef.current = null;
            diagramPassRef.current = null;
            return markStale;
        }
        drawnDiagramsRef.current = {
            sources: loadResult.mermaidSources,
            isDark,
            langFontFamilies,
        };
        diagramPassRef.current = {
            promise: renderMermaidDiagrams(
                articleElement,
                loadResult.mermaidSources,
                { isDark, checkIsStale },
            ),
            sources: loadResult.mermaidSources,
            isDark,
            checkIsStale,
        };
        diagramPassWaitRef.current?.();
        return markStale;
    }, [loadResult, theme, langFontFamilies]);

    // Printing: main asks this page to get ready before every print of the
    // window -- File > Print, and the Print below, which gets it ready itself
    // first -- and the print sheet in `MarkdownPreviewAppComp.scss` makes the
    // paper light. Ready is every diagram drawn, and in a dark window drawn
    // again in the light theme for the paper (`markdownPrintHelpers.ts`); a
    // second ask finds nothing left to draw. A page drawn again meanwhile --
    // a save beside it, a pause in the typing -- is waited for in its turn,
    // a few times at most.
    const waitForDiagramsForPrint = useCallback(async () => {
        // Printed just after the window opened, the page's diagrams may still
        // wait for the languages' faces, their source showing: the paper
        // waits for their drawing to start rather than carry the source.
        const pageElement = articleRef.current;
        if (
            diagramPassRef.current === null &&
            pageElement !== null &&
            checkHasUndrawnDiagrams(pageElement)
        ) {
            await waitAtMost(
                new Promise<void>((resolve) => {
                    diagramPassWaitRef.current = resolve;
                }),
                PRINT_DIAGRAM_WAIT_MILLISECONDS,
            );
            diagramPassWaitRef.current = null;
        }
        for (let attempt = 0; attempt < 3; attempt++) {
            const diagramPass = diagramPassRef.current;
            const articleElement = articleRef.current;
            if (diagramPass === null || articleElement === null) {
                return;
            }
            await waitAtMost(
                diagramPass.promise,
                PRINT_DIAGRAM_WAIT_MILLISECONDS,
            );
            if (diagramPass.isDark && !diagramPass.checkIsStale()) {
                await waitAtMost(
                    drawLightDiagramsForPrint(
                        articleElement,
                        diagramPass.sources,
                        diagramPass.checkIsStale,
                    ),
                    PRINT_DIAGRAM_WAIT_MILLISECONDS,
                );
            }
            if (!diagramPass.checkIsStale()) {
                return;
            }
        }
    }, []);
    // A page that links verses, people or places asks first whether their
    // Bible text and details go at the end of the printout
    // (`MarkdownPrintAskComp`); Cancel prints nothing.
    const askAboutPrintReferences = useCallback(
        (references: PrintReferencesType) => {
            return new Promise<MarkdownPrintAnswerType>((resolve) => {
                const timeout = setTimeout(() => {
                    answer('cancel');
                }, PRINT_ASK_MILLISECONDS);
                function answer(value: MarkdownPrintAnswerType) {
                    clearTimeout(timeout);
                    printAnswerRef.current = null;
                    resolve(value);
                }
                printAnswerRef.current = answer;
                setPrintAsk({ references, isReading: false });
            });
        },
        [],
    );
    const handlePrintAnswering = useCallback(
        (answer: MarkdownPrintAnswerType) => {
            printAnswerRef.current?.(answer);
        },
        [],
    );
    // The page a print is to take, drawn first when it is not the one on
    // screen: the last words typed, drawn into the page beside the editor
    // only once the typing pauses, or a draw still held for a print before.
    // The print goes on once it is on the page, so the paper never misses
    // them.
    const drawPageForPrint = useCallback(
        async (printHold: {
            heldLoadResult: MarkdownPreviewLoadResultType | null;
        }) => {
            let newLoadResult = printHold.heldLoadResult;
            printHold.heldLoadResult = null;
            if (isEditingRef.current && isDraftDrawPendingRef.current) {
                // The print draws it now, so the draw still waiting on the
                // typing is called off.
                draftPreviewAttemptTimeout(() => {}, true);
                newLoadResult = genDraftLoadResult() ?? newLoadResult;
            }
            if (newLoadResult === null) {
                return;
            }
            const printLoadResult = newLoadResult;
            setLoadResult(printLoadResult);
            await waitAtMost(
                new Promise<void>((resolve) => {
                    printDrawRef.current = {
                        loadResult: printLoadResult,
                        resolve,
                    };
                }),
                PRINT_PAGE_WAIT_MILLISECONDS,
            );
            printDrawRef.current = null;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // True once the page is ready for paper; false when the person said
    // Cancel, or a print is already being got ready -- main then prints
    // nothing.
    const preparePrint = useCallback(async () => {
        if (
            Date.now() - preparedPrintAtRef.current <
            PREPARED_PRINT_MILLISECONDS
        ) {
            preparedPrintAtRef.current = 0;
            return true;
        }
        if (isPreparingPrintRef.current) {
            return false;
        }
        isPreparingPrintRef.current = true;
        setIsPreparingPrint(true);
        // Held from here until the paper is made; a print main has not made
        // yet keeps its hold, and lets the next one draw what it held.
        const printHold = printHoldRef.current ?? {
            heldLoadResult: null,
            timeout: null,
        };
        if (printHold.timeout !== null) {
            clearTimeout(printHold.timeout);
            printHold.timeout = null;
        }
        printHoldRef.current = printHold;
        let isReady = false;
        try {
            await drawPageForPrint(printHold);
            // The page's verses, people and places are made links a moment
            // after it is drawn, and the question counts them.
            const pageReferences = pageReferencesRef.current;
            if (pageReferences !== null) {
                await waitAtMost(pageReferences, PRINT_PAGE_WAIT_MILLISECONDS);
            }
            const articleElement = articleRef.current;
            let appendix: PrintAppendixType | null = null;
            if (articleElement !== null) {
                // A print never carries the one before's.
                removePrintAppendix(articleElement);
                const references = await collectPageReferences(articleElement);
                if (references !== null) {
                    const answer = await askAboutPrintReferences(references);
                    if (answer === 'cancel') {
                        return false;
                    }
                    if (answer === 'add') {
                        setPrintAsk({ references, isReading: true });
                        appendix = await readPageReferences(references);
                    }
                    setPrintAsk(null);
                }
            }
            await waitForDiagramsForPrint();
            const currentArticleElement = articleRef.current;
            if (currentArticleElement !== null) {
                await waitAtMost(
                    loadPicturesForPrint(currentArticleElement),
                    PRINT_PAGE_WAIT_MILLISECONDS,
                );
            }
            if (appendix !== null && currentArticleElement !== null) {
                const { addPrintAppendix } =
                    await import('./markdownPrintAppendixHelpers');
                addPrintAppendix(
                    currentArticleElement,
                    appendix,
                    genPrintAppendixLabels(),
                );
            }
            isReady = true;
            return true;
        } finally {
            printAnswerRef.current = null;
            isPreparingPrintRef.current = false;
            setPrintAsk(null);
            setIsPreparingPrint(false);
            if (isReady) {
                // Main prints at once (`afterprint` lets go); one it never
                // makes lets the page go after this.
                printHold.timeout = setTimeout(
                    releasePageAfterPrint,
                    PRINT_HOLD_MILLISECONDS,
                );
            } else {
                releasePageAfterPrint();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        // Blink reads the system theme as light while printing: a window on
        // the System theme would otherwise draw itself again mid-print.
        keepThemeWhilePrinting();
        // The paper is made -- unless a print is being got ready again,
        // which holds the page in its turn.
        const handleAfterPrint = () => {
            if (!isPreparingPrintRef.current) {
                releasePageAfterPrint();
            }
        };
        globalThis.addEventListener('afterprint', handleAfterPrint);
        const unregisterPrintPreparation =
            registerPrintPreparation(preparePrint);
        return () => {
            globalThis.removeEventListener('afterprint', handleAfterPrint);
            unregisterPrintPreparation();
            const timeout = printHoldRef.current?.timeout;
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, []);
    const handlePrinting = useCallback(async () => {
        if (await preparePrint()) {
            preparedPrintAtRef.current = Date.now();
            printHtmlText();
        }
    }, [preparePrint]);

    const handleSaving = useCallback(async () => {
        const currentFilePath = filePathRef.current;
        const draftText = draftTextRef.current;
        if (
            isSavingRef.current ||
            currentFilePath === null ||
            draftText === null ||
            !checkIsDraftUnsaved()
        ) {
            return;
        }
        isSavingRef.current = true;
        const isSaved = await saveMarkdownPreviewFile(
            currentFilePath,
            draftText,
        );
        isSavingRef.current = false;
        if (!isSaved) {
            showWarning(tran('Error'));
            return;
        }
        savedTextRef.current = draftText;
        // Typing may have gone on while the file was being written.
        setIsDirty(checkIsDraftUnsaved());
        if (!isEditingRef.current && !checkIsDraftUnsaved()) {
            endEditSession();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Whatever closes or reloads this window while something is unsaved is
    // stopped once, said why, and let through on the fourth try -- the app's
    // own rule for a window that holds unsaved work.
    const blockUnload = useMemo(() => {
        return genBlockUnload(() => {
            showWarning(genUnsavedWarningText(true));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        if (!isDirty) {
            return;
        }
        globalThis.addEventListener('beforeunload', blockUnload);
        return () => {
            globalThis.removeEventListener('beforeunload', blockUnload);
        };
    }, [isDirty, blockUnload]);

    // Ctrl+S wherever the focus is -- the page beside the editor, or a draft's
    // preview with the editor hidden. The editor answers it itself (and so
    // marks it handled) while it has the focus.
    useAppEffect(() => {
        if (!isDirty) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || !checkIsSaveKeyEvent(event)) {
                return;
            }
            event.preventDefault();
            void handleSaving();
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => {
            globalThis.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDirty, handleSaving]);

    const handleReloading = useCallback(() => {
        setReloadCount((count) => {
            return count + 1;
        });
    }, []);

    const handleEditToggling = useCallback(async () => {
        if (isEditingRef.current) {
            // A draft with nothing unsaved is let go here; one with unsaved
            // words stays, and the page, now the whole window, still draws it.
            if (!checkIsDraftUnsaved()) {
                endEditSession();
            }
            setIsEditing(false);
            return;
        }
        const currentFilePath = filePathRef.current;
        if (currentFilePath === null) {
            return;
        }
        if (draftTextRef.current === null) {
            // Read afresh, not taken from the preview: the editor must start
            // from what is on disk now.
            const textResult = await readMarkdownPreviewText(currentFilePath);
            if (filePathRef.current !== currentFilePath) {
                return;
            }
            if (textResult.status !== 'ready') {
                setLoadResult({ status: textResult.status });
                return;
            }
            savedTextRef.current = textResult.text;
            draftTextRef.current = textResult.text;
        }
        isEditReadSkippedRef.current = true;
        setEditorText(draftTextRef.current);
        setIsEditing(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraftChanging = useCallback((newText: string) => {
        draftTextRef.current = newText;
        setIsDirty(checkIsDraftUnsaved());
        isDraftDrawPendingRef.current = true;
        draftPreviewAttemptTimeout(() => {
            // Hiding the editor draws the draft at once; a file left in the
            // meantime has no draft any more.
            if (isEditingRef.current) {
                renderDraftPreview();
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDiscarding = useCallback(() => {
        const savedText = savedTextRef.current;
        if (savedText === null) {
            return;
        }
        draftTextRef.current = savedText;
        setIsDirty(false);
        setWarningText('');
        if (isEditingRef.current) {
            setEditorText(savedText);
            setEditorKey((key) => {
                return key + 1;
            });
            draftPreviewAttemptTimeout(renderDraftPreview, true);
            return;
        }
        endEditSession();
        setReloadCount((count) => {
            return count + 1;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpeningInDefaultApp = useCallback(() => {
        if (filePathRef.current !== null) {
            appProvider.systemUtils.openFile(filePathRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRevealing = useCallback(() => {
        if (filePathRef.current !== null) {
            showFileOrDirExplorer(filePathRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The Sections list (2026-11-12, the user: _when the markdown content has
    // titles then it should allow doing quick jumping to the title_). Read
    // from the page when it opens; a page drawn again -- a save beside it, a
    // pause in the typing -- closes it, since its headings may have changed.
    useAppEffect(() => {
        setHeadingList(null);
    }, [loadResult]);
    const closeHeadingList = useCallback((isFocusBack: boolean) => {
        setHeadingList(null);
        if (isFocusBack) {
            headingToggleRef.current?.focus();
        }
    }, []);
    const handleHeadingListToggling = useCallback(() => {
        const articleElement = articleRef.current;
        const pageElement = pageRef.current;
        if (
            headingListRef.current !== null ||
            articleElement === null ||
            pageElement === null
        ) {
            setHeadingList(null);
            return;
        }
        const newHeadingList = readMarkdownHeadings(
            articleElement,
            pageElement,
        );
        setHeadingList(
            newHeadingList.headings.length > 0 ? newHeadingList : null,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleHeadingPicking = useCallback((index: number) => {
        const articleElement = articleRef.current;
        if (articleElement !== null) {
            scrollToMarkdownHeading(articleElement, index);
        }
        closeHeadingList(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * The ONLY way a press leaves this page. Every link is stopped here --
     * left, middle or modified click -- and then decided: a heading in this
     * file scrolls, a web address goes to the system browser, a file opens
     * in a window of its own (`openResourceFileWindow`: another preview, the
     * PDF viewer, a note's preview; any other file is SHOWN in its folder and
     * never run). An `<a href>` left to the browser would be resolved against
     * the app's own origin, or opened as a new app window. A name, place or
     * verse the page mentions opens its panel in the Reader.
     */
    const handleLinkPressing = useCallback((event: MouseEvent) => {
        const target = event.target as Element | null;
        const articleElement = articleRef.current;
        if (articleElement === null) {
            return;
        }
        const refElement = target?.closest?.(`.${MARKDOWN_REF_CLASS}`);
        if (
            refElement &&
            articleElement.contains(refElement) &&
            event.type === 'click'
        ) {
            const selection = globalThis.getSelection();
            if (selection === null || selection.isCollapsed) {
                openPressedReference(refElement).catch(handleError);
            }
            return;
        }
        const anchorElement = target?.closest?.('a');
        if (!anchorElement || !articleElement.contains(anchorElement)) {
            return;
        }
        event.preventDefault();
        if (event.type === 'auxclick' && event.button !== 1) {
            return;
        }
        const href = classifyMarkdownHref(
            anchorElement.getAttribute('href') ?? '',
        );
        const currentFilePath = filePathRef.current;
        if (href.kind === 'anchor') {
            const escapedSlug = CSS.escape(href.slug);
            // A heading first, then an anchor the file wrote in HTML itself
            // (`<a name="top">`), looked for inside the document only.
            (
                document.getElementById(toHeadingElementId(href.slug)) ??
                articleElement.querySelector(
                    `[id="${escapedSlug}"], a[name="${escapedSlug}"]`,
                )
            )?.scrollIntoView({ block: 'start' });
        } else if (href.kind === 'web') {
            appProvider.browserUtils.openExternalURL(href.url);
        } else if (href.kind === 'local' && currentFilePath !== null) {
            openLinkedFile(
                toMarkdownPreviewTargetPath(currentFilePath, href.filePath),
            ).catch(handleError);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fileName = filePath === null ? '' : pathBasename(filePath);
    const articleStyle = (
        langFontFamilies
            ? {
                  '--app-markdown-lang-font-families': langFontFamilies,
              }
            : {}
    ) as CSSProperties;
    const isEditable = isEditing || loadResult.status === 'ready';
    const editToggleTitle = isEditing ? tran('Hide Editor') : tran('Edit');
    return (
        <div className="app app-markdown-preview" data-bs-theme={theme}>
            <div className="app-markdown-preview-head">
                <i className="bi bi-markdown app-markdown-preview-icon" />
                <span
                    className="app-markdown-preview-name app-ellipsis"
                    title={filePath ?? ''}
                >
                    {fileName}
                    {isDirty ? (
                        <span
                            className="app-markdown-preview-unsaved"
                            title={tran('Unsaved changes')}
                            aria-label={tran('Unsaved changes')}
                        >
                            {' *'}
                        </span>
                    ) : null}
                </span>
                {/* Only for a page with a heading to go to. */}
                {hasHeadings ? (
                    <button
                        ref={headingToggleRef}
                        type="button"
                        className={
                            'btn btn-sm app-markdown-preview-action' +
                            (headingList === null ? '' : ' active')
                        }
                        title={tran('Sections')}
                        aria-label={tran('Sections')}
                        aria-expanded={headingList !== null}
                        onClick={handleHeadingListToggling}
                    >
                        <i className="bi bi-list-nested" />
                    </button>
                ) : null}
                {headingList === null ? null : (
                    <MarkdownHeadingListComp
                        headings={headingList.headings}
                        currentIndex={headingList.currentIndex}
                        toggleRef={headingToggleRef}
                        onPick={handleHeadingPicking}
                        onClose={closeHeadingList}
                    />
                )}
                {isDirty ? (
                    <button
                        type="button"
                        className="btn btn-sm app-markdown-preview-action"
                        title={tran('Discard unsaved changes')}
                        aria-label={tran('Discard unsaved changes')}
                        onClick={handleDiscarding}
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                    </button>
                ) : null}
                {isEditing || isDirty ? (
                    <button
                        type="button"
                        className={
                            'btn btn-sm app-markdown-preview-action' +
                            (isDirty ? ' app-markdown-preview-save' : '')
                        }
                        title={`${tran('Save')} [${appProvider.systemUtils.isMac ? '⌘+S' : 'Ctrl+S'}]`}
                        aria-label={tran('Save')}
                        disabled={!isDirty}
                        onClick={handleSaving}
                    >
                        <i className="bi bi-floppy" />
                    </button>
                ) : null}
                <button
                    type="button"
                    className={
                        'btn btn-sm app-markdown-preview-action' +
                        (isEditing ? ' active' : '')
                    }
                    title={editToggleTitle}
                    aria-label={editToggleTitle}
                    disabled={filePath === null || !isEditable}
                    onClick={handleEditToggling}
                >
                    <i className="bi bi-pencil-square" />
                </button>
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Reload')}
                    aria-label={tran('Reload')}
                    disabled={filePath === null || isDirty}
                    onClick={handleReloading}
                >
                    <i className="bi bi-arrow-clockwise" />
                </button>
                {/* THIS window is printed, not a copy of the page: the
                    Print Preview is drawn from the very faces, layout and
                    diagrams on screen, always in the light theme. What
                    leaves the head row, the editor and the scrolling out of
                    it, and turns a dark page light, is the print sheet in
                    `MarkdownPreviewAppComp.scss`; `preparePrint` above runs
                    first. */}
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Print')}
                    aria-label={tran('Print')}
                    disabled={loadResult.status !== 'ready' || isPreparingPrint}
                    onClick={handlePrinting}
                >
                    <i className="bi bi-printer" />
                </button>
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Open in Default App')}
                    aria-label={tran('Open in Default App')}
                    disabled={filePath === null}
                    onClick={handleOpeningInDefaultApp}
                >
                    <i className="bi bi-box-arrow-up-right" />
                </button>
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={getMenuTitleRevealFile()}
                    aria-label={getMenuTitleRevealFile()}
                    disabled={filePath === null}
                    onClick={handleRevealing}
                >
                    <i className="bi bi-folder2-open" />
                </button>
                <MarkdownPreviewChatbotButtonComp filePath={filePath} />
            </div>
            {printAsk === null ? null : (
                <MarkdownPrintAskComp
                    verseCount={printAsk.references.verses.length}
                    nameCount={printAsk.references.names.length}
                    placeCount={printAsk.references.places.length}
                    isReading={printAsk.isReading}
                    onAnswer={handlePrintAnswering}
                />
            )}
            {warningText ? (
                <div className="app-markdown-preview-warning" role="status">
                    <i className="bi bi-exclamation-triangle" />
                    <span>{warningText}</span>
                </div>
            ) : null}
            <div className="app-markdown-preview-body">
                {/* The editor on the left, the page on the right. The page
                    keeps its place in the tree either way, so showing or
                    hiding the editor never mounts it again. */}
                {isEditing ? (
                    <div className="app-markdown-preview-editor-pane">
                        <Suspense fallback={null}>
                            <LazyMarkdownPreviewEditorComp
                                key={editorKey}
                                text={editorText}
                                isDarkMode={theme === 'dark'}
                                pageRef={pageRef}
                                articleRef={articleRef}
                                onDraftChange={handleDraftChanging}
                                onSave={handleSaving}
                            />
                        </Suspense>
                    </div>
                ) : null}
                <div ref={pageRef} className="app-markdown-preview-page">
                    {/* Keyed apart: the page's words are put in outside
                        React, which would keep them in a status box made
                        out of the same element -- a file deleted while
                        shown read as the whole old page, its "File not
                        found" under the last line. */}
                    {loadResult.status === 'ready' ? (
                        <div
                            key="article"
                            ref={articleRef}
                            className="app-markdown-body app-selectable-text"
                            style={articleStyle}
                            onClick={handleLinkPressing}
                            onAuxClick={handleLinkPressing}
                        />
                    ) : loadResult.status === 'loading' ? null : (
                        <div
                            key="status"
                            className="app-markdown-preview-status"
                        >
                            <i className="bi bi-exclamation-circle" />
                            <span>
                                {tran(STATUS_MESSAGE_MAP[loadResult.status])}
                            </span>
                        </div>
                    )}
                    {/* Back to the top, once the page has left it. Held in
                        the body's corner while the page scrolls under it,
                        clear of the scrollbar; never on paper. */}
                    <ScrollToTopComp style={{ right: '12px' }} />
                </div>
            </div>
        </div>
    );
}
