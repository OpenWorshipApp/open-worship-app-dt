import { useRef, useState } from 'react';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import { renderMarkdown } from '../lyric-list/markdownHelpers';
import { useAppEffect } from '../helper/appHooks';
import appProvider from '../server/appProvider';

/**
 * The whole syntax on one page, for what the rows below leave out (the user,
 * 2026-11-09: _provide opening link as well_). Opened in the system browser:
 * a link followed inside the panel would take the Presenter window with it.
 */
export const MARKDOWN_CHEAT_SHEET_URL =
    'https://www.markdownguide.org/cheat-sheet/';

function handleCheatSheetOpening() {
    appProvider.browserUtils.openExternalURL(MARKDOWN_CHEAT_SHEET_URL);
}

/**
 * The marks a Quick Text is written in, each as it is typed (2026-11-09, the
 * user: _for quick text, add button somewhere to open markdown lesson_). The
 * sample words are the app's own labels, so a volunteer reads the lesson in
 * their language and sees their own script set bold or as a heading.
 *
 * Three of them are one lesson: a single Enter does NOT break the line on
 * the screen (markdown joins the two lines), a `\` at the end of a line does,
 * and an empty line starts a new paragraph -- the thing a verse typed line by
 * line trips over first.
 */
export function genMarkdownLessonSourceList() {
    const text = tran('Text');
    const heading = tran('Heading');
    return [
        `## ${heading}`,
        `### ${heading}`,
        `**${tran('Bold')}**`,
        `*${tran('Italic')}*`,
        `~~${text}~~`,
        `- ${text}\n- ${text}`,
        `1. ${text}\n2. ${text}`,
        `> ${tran('Quote')}`,
        `${text}\n${text}`,
        `${text}\\\n${text}`,
        `${text}\n\n${text}`,
        '---',
    ];
}

/**
 * Each mark beside what it draws, drawn by the SAME renderer and sanitizer
 * the screen's quick text goes through, so the right-hand side is what the
 * congregation would see and not a picture of it. Mounted only while the
 * lesson is open: the rendered copies go when it closes.
 */
export default function QuickTextMarkdownLessonComp({
    fontFamily,
    fontWeight,
}: Readonly<{
    fontFamily: string;
    fontWeight: string;
}>) {
    const sourceList = genMarkdownLessonSourceList();
    // The words change only with the app's language.
    const sourcesKey = sourceList.join('\n\n');
    const [htmlList, setHtmlList] = useState<string[]>([]);
    useAppEffect(() => {
        let isStale = false;
        Promise.all(
            sourceList.map(async (source) => {
                const { html } = await renderMarkdown(source);
                return sanitizeHtml(html);
            }),
        )
            .then((list) => {
                if (!isStale) {
                    setHtmlList(list);
                }
            })
            .catch((error) => {
                handleError(error);
            });
        return () => {
            isStale = true;
        };
    }, [sourcesKey]);
    const containerRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        // Opened from the row above the editor, so it unfolds below the
        // fold of a short panel: bring it in, as little as it takes.
        containerRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, []);
    const resultStyle = {
        fontFamily: fontFamily || undefined,
        fontWeight: fontWeight || undefined,
    };
    return (
        <div
            ref={containerRef}
            className="fg-md-lesson"
            role="region"
            aria-label={tran('Markdown Lesson')}
        >
            <div className="fg-md-lesson-link">
                <button
                    type="button"
                    className="fg-quiet-btn"
                    title={MARKDOWN_CHEAT_SHEET_URL}
                    onClick={handleCheatSheetOpening}
                >
                    <i
                        className="bi bi-box-arrow-up-right"
                        aria-hidden="true"
                    />
                    <span>{tran('Open Link in Browser')}</span>
                </button>
                <span className="fg-md-lesson-url">
                    {MARKDOWN_CHEAT_SHEET_URL}
                </span>
            </div>
            {sourceList.map((source, index) => {
                return (
                    <div key={source} className="fg-md-lesson-row">
                        <code className="fg-md-lesson-source">{source}</code>
                        <i
                            className="bi bi-arrow-right fg-md-lesson-arrow"
                            aria-hidden="true"
                        />
                        <div
                            className="fg-markdown-preview fg-md-lesson-result"
                            style={resultStyle}
                            dangerouslySetInnerHTML={{
                                __html: htmlList[index] ?? '',
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
