import './MarkdownPreviewAppComp.scss';

import type { CSSProperties, MouseEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppEffectAsync,
} from '../helper/appHooks';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { initAllLangCss, tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { pathBasename } from '../server/fileHelpers';
import { renderMermaidDiagrams } from './markdownMermaidHelpers';
import {
    loadMarkdownPreviewFile,
    type MarkdownPreviewLoadResultType,
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

// Enough to walk back up a chain of linked documents; bounded because it is
// kept for as long as the window is open.
const MAX_BACK_FILE_PATHS = 50;

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
 * file from a Khmer congregation's shared folder is as likely to be Khmer as
 * English, whatever language the app itself is shown in, and a system font
 * with no Khmer glyphs would draw it as boxes.
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
    document.title = `${appProvider.windowTitle} - ${pathBasename(filePath)}`;
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
    const articleRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const filePathRef = useAppCurrentRef(filePath);
    const backFilePathsRef = useAppCurrentRef(backFilePaths);

    useAppEffect(() => {
        if (filePath === null) {
            setLoadResult({ status: 'not-found' });
            return;
        }
        document.title = `${appProvider.windowTitle} - ${pathBasename(filePath)}`;
        // A reload keeps what is on screen until the new render is ready, so
        // saving the file in an editor does not flash the page empty.
        let isCancelled = false;
        loadMarkdownPreviewFile(filePath).then((newLoadResult) => {
            if (!isCancelled) {
                setLoadResult(newLoadResult);
            }
        });
        return () => {
            isCancelled = true;
        };
    }, [filePath, reloadCount]);

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
        // The rendered file never goes through React: it is markdown-it's
        // output as the sanitizer left it, and the mermaid diagrams are swapped
        // into it in place afterwards, which React would undo on its next
        // render.
        articleElement.innerHTML = loadResult.html;
        let isStale = false;
        void renderMermaidDiagrams(articleElement, loadResult.mermaidSources, {
            isDark: theme === 'dark',
            checkIsStale: () => {
                return isStale;
            },
        });
        return () => {
            isStale = true;
        };
    }, [loadResult, theme]);

    const handleNavigating = useCallback((newFilePath: string) => {
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
        bodyRef.current?.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoingBack = useCallback(() => {
        const newBackFilePaths = [...backFilePathsRef.current];
        const previousFilePath = newBackFilePaths.pop();
        if (previousFilePath === undefined) {
            return;
        }
        setBackFilePaths(newBackFilePaths);
        setWindowUrlFilePath(previousFilePath);
        setLoadResult({ status: 'loading' });
        setFilePath(previousFilePath);
        bodyRef.current?.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReloading = useCallback(() => {
        setReloadCount((count) => {
            return count + 1;
        });
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
    return (
        <div className="app app-markdown-preview" data-bs-theme={theme}>
            <div className="app-markdown-preview-head">
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Back')}
                    aria-label={tran('Back')}
                    disabled={backFilePaths.length === 0}
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
                </span>
                <button
                    type="button"
                    className="btn btn-sm app-markdown-preview-action"
                    title={tran('Reload')}
                    aria-label={tran('Reload')}
                    disabled={filePath === null}
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
            <div ref={bodyRef} className="app-markdown-preview-body">
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
    );
}
