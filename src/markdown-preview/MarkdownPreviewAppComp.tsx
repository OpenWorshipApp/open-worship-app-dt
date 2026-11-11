import './MarkdownPreviewAppComp.scss';

import type { CSSProperties, MouseEvent } from 'react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppEffectAsync,
} from '../helper/appHooks';
import { genBlockUnload } from '../helper/blockUnloadHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { initAllLangCss, tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { pathBasename } from '../server/fileHelpers';
import {
    putBackDrawnDiagrams,
    renderMermaidDiagrams,
    takeDrawnDiagrams,
} from './markdownMermaidHelpers';
import {
    loadMarkdownPreviewFile,
    type MarkdownPreviewLoadResultType,
    readMarkdownPreviewText,
    renderMarkdownPreviewText,
    saveMarkdownPreviewFile,
    toMarkdownPreviewTargetPath,
} from './markdownPreviewFileHelpers';
import {
    checkIsMarkdownPreviewFileName,
    getMarkdownPreviewFilePath,
    MARKDOWN_PREVIEW_FILE_PARAM_NAME,
} from './markdownPreviewParamHelpers';
import {
    classifyMarkdownHref,
    toHeadingElementId,
} from './markdownPreviewRenderHelpers';

// Monaco is the heaviest thing this window could load, and most windows are
// only read: it comes in the first time Edit is pressed, never before.
const LazyMarkdownPreviewEditorComp = lazy(() => {
    return import('./MarkdownPreviewEditorComp');
});

// Enough to walk back up a chain of linked documents; bounded because it is
// kept for as long as the window is open.
const MAX_BACK_FILE_PATHS = 50;

// Long enough to read two sentences; the bar is a note, not a question.
const WARNING_SHOW_MILLISECONDS = 6000;

// The preview beside the editor is drawn again once typing pauses this long,
// not on every key: a render is the whole page, diagrams included.
const DRAFT_PREVIEW_MILLISECONDS = 500;

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
 */
function useLangFontFamilies() {
    const [langFontFamilies, setLangFontFamilies] = useState('');
    useAppEffectAsync(
        async (methodContext) => {
            const langDataList = await initAllLangCss();
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

function setWindowUrlFilePath(filePath: string) {
    const url = new URL(globalThis.location.href);
    url.searchParams.set(MARKDOWN_PREVIEW_FILE_PARAM_NAME, filePath);
    // REPLACED, not pushed: the window's URL is what the main process matches
    // a new press against, so it must name the file on screen now. The back
    // button walks this window's own list instead.
    globalThis.history.replaceState(null, '', url.toString());
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
    const [filePath, setFilePath] = useState<string | null>(() => {
        return getMarkdownPreviewFilePath(globalThis.location.href);
    });
    const [backFilePaths, setBackFilePaths] = useState<string[]>([]);
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
    } | null>(null);
    const filePathRef = useAppCurrentRef(filePath);
    const backFilePathsRef = useAppCurrentRef(backFilePaths);
    const isEditingRef = useAppCurrentRef(isEditing);

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

    // The draft drawn into the page beside the editor.
    const renderDraftPreview = useCallback(() => {
        const currentFilePath = filePathRef.current;
        const draftText = draftTextRef.current;
        if (currentFilePath === null || draftText === null) {
            return;
        }
        setLoadResult(renderMarkdownPreviewText(currentFilePath, draftText));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
            setLoadResult(
                renderMarkdownPreviewText(filePath, draftTextRef.current),
            );
            return;
        }
        // A reload keeps what is on screen until the new render is ready, so
        // saving the file in an editor does not flash the page empty.
        loadMarkdownPreviewFile(filePath).then((newLoadResult) => {
            if (!isCancelled) {
                setLoadResult(newLoadResult);
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
        const articleElement = articleRef.current;
        if (articleElement === null || loadResult.status !== 'ready') {
            return;
        }
        const isDark = theme === 'dark';
        // A diagram already drawn from the same source, in the same theme, is
        // kept rather than drawn again: the page beside the editor is
        // rendered again on every pause in the typing.
        const drawnDiagrams = drawnDiagramsRef.current;
        const drawnMap =
            drawnDiagrams !== null && drawnDiagrams.isDark === isDark
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
        drawnDiagramsRef.current = {
            sources: loadResult.mermaidSources,
            isDark,
        };
        let isStale = false;
        void renderMermaidDiagrams(articleElement, loadResult.mermaidSources, {
            isDark,
            checkIsStale: () => {
                return isStale;
            },
        });
        return () => {
            isStale = true;
        };
    }, [loadResult, theme]);

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

    const handleNavigating = useCallback((newFilePath: string) => {
        if (checkIsDraftUnsaved()) {
            showWarning(genUnsavedWarningText(false));
            return;
        }
        endEditSession();
        setIsEditing(false);
        const currentFilePath = filePathRef.current;
        if (currentFilePath !== null) {
            setBackFilePaths(
                [...backFilePathsRef.current, currentFilePath].slice(
                    -MAX_BACK_FILE_PATHS,
                ),
            );
        }
        setWindowUrlFilePath(newFilePath);
        setLoadResult({ status: 'loading' });
        setFilePath(newFilePath);
        pageRef.current?.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoingBack = useCallback(() => {
        if (checkIsDraftUnsaved()) {
            showWarning(genUnsavedWarningText(false));
            return;
        }
        const newBackFilePaths = [...backFilePathsRef.current];
        const previousFilePath = newBackFilePaths.pop();
        if (previousFilePath === undefined) {
            return;
        }
        endEditSession();
        setIsEditing(false);
        setBackFilePaths(newBackFilePaths);
        setWindowUrlFilePath(previousFilePath);
        setLoadResult({ status: 'loading' });
        setFilePath(previousFilePath);
        pageRef.current?.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    /**
     * The ONLY way a press leaves this page. Every link is stopped here --
     * left, middle or modified click -- and then decided: a heading in this
     * file scrolls, a web address goes to the system browser, another
     * markdown file opens in this window, any other file is SHOWN in its
     * folder and never run. An `<a href>` left to the browser would be
     * resolved against the app's own origin, or opened as a new app window.
     */
    const handleLinkPressing = useCallback((event: MouseEvent) => {
        const target = event.target as Element | null;
        const anchorElement = target?.closest?.('a');
        const articleElement = articleRef.current;
        if (
            !anchorElement ||
            articleElement === null ||
            !articleElement.contains(anchorElement)
        ) {
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
            const targetPath = toMarkdownPreviewTargetPath(
                currentFilePath,
                href.filePath,
            );
            if (checkIsMarkdownPreviewFileName(targetPath)) {
                handleNavigating(targetPath);
            } else {
                showFileOrDirExplorer(targetPath);
            }
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
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Back')}
                    aria-label={tran('Back')}
                    disabled={backFilePaths.length === 0 || isDirty}
                    onClick={handleGoingBack}
                >
                    <i className="bi bi-arrow-left" />
                </button>
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
            </div>
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
                                onDraftChange={handleDraftChanging}
                                onSave={handleSaving}
                            />
                        </Suspense>
                    </div>
                ) : null}
                <div ref={pageRef} className="app-markdown-preview-page">
                    {loadResult.status === 'ready' ? (
                        <div
                            ref={articleRef}
                            className="app-markdown-body app-selectable-text"
                            style={articleStyle}
                            onClick={handleLinkPressing}
                            onAuxClick={handleLinkPressing}
                        />
                    ) : loadResult.status === 'loading' ? null : (
                        <div className="app-markdown-preview-status">
                            <i className="bi bi-exclamation-circle" />
                            <span>
                                {tran(STATUS_MESSAGE_MAP[loadResult.status])}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
