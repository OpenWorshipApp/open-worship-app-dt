import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react';
import { useCallback, useRef } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export type MarkdownPrintAnswerType = 'add' | 'without' | 'cancel';
// What the page is being got ready for: paper, or a Word document.
export type MarkdownPageOutputType = 'print' | 'word';

function preventFocusLeaving(event: MouseEvent) {
    // A press beside the question must not take the focus away from it, or
    // Tab and Esc would reach the page behind.
    if (event.target === event.currentTarget) {
        event.preventDefault();
    }
}

/**
 * Asked before a print of a page that names verses, people or places
 * (2026-11-12, the user: _when print if there bible verses and names, let
 * ask user do they want to print those information_): add their Bible text
 * and details at the end of the printout, print the page alone, or not
 * print. Its own small dialog -- this window runs none of the app's popups.
 * It is never on paper (`MarkdownPreviewAppComp.scss`), and while the
 * details are read its buttons wait. Asked the same way before a Word
 * document is made of the page (`purpose: 'word'`, 2026-11-14), the details
 * then going at the end of the document.
 */
export default function MarkdownPrintAskComp({
    verseCount,
    nameCount,
    placeCount,
    isReading,
    purpose = 'print',
    onAnswer,
}: Readonly<{
    verseCount: number;
    nameCount: number;
    placeCount: number;
    isReading: boolean;
    purpose?: MarkdownPageOutputType;
    onAnswer: (answer: MarkdownPrintAnswerType) => void;
}>) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const onAnswerRef = useAppCurrentRef(onAnswer);
    const isReadingRef = useAppCurrentRef(isReading);

    // Esc wherever the focus is: the question is the window's until answered.
    useAppEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            if (!isReadingRef.current) {
                onAnswerRef.current('cancel');
            }
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => {
            globalThis.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Tab goes round the question's own buttons.
    const handleKeyDown = useCallback((event: ReactKeyboardEvent) => {
        const dialogElement = dialogRef.current;
        if (event.key !== 'Tab' || dialogElement === null) {
            return;
        }
        const buttonList = Array.from(
            dialogElement.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)',
            ),
        );
        if (buttonList.length === 0) {
            event.preventDefault();
            return;
        }
        const index = buttonList.indexOf(
            document.activeElement as HTMLButtonElement,
        );
        const nextIndex = event.shiftKey
            ? (index <= 0 ? buttonList.length : index) - 1
            : (index + 1) % buttonList.length;
        event.preventDefault();
        buttonList[nextIndex].focus();
    }, []);

    const countText = [
        verseCount > 0 ? `${tran('Verses')}: ${verseCount}` : '',
        nameCount > 0 ? `${tran('Names')}: ${nameCount}` : '',
        placeCount > 0 ? `${tran('Places')}: ${placeCount}` : '',
    ]
        .filter((text) => {
            return text !== '';
        })
        .join(' · ');
    const isWord = purpose === 'word';
    return (
        <div
            className="app-markdown-print-ask-backdrop"
            onMouseDown={preventFocusLeaving}
        >
            <div
                ref={dialogRef}
                className="app-markdown-print-ask card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-markdown-print-ask-question"
                aria-describedby="app-markdown-print-ask-counts"
                aria-busy={isReading}
                onKeyDown={handleKeyDown}
            >
                <div className="card-body">
                    <p
                        id="app-markdown-print-ask-question"
                        className="app-markdown-print-ask-question"
                    >
                        <i
                            className={
                                isWord
                                    ? 'bi bi-file-earmark-word'
                                    : 'bi bi-printer'
                            }
                        />
                        {isWord
                            ? tran(
                                  'Add the Bible text and the name and place details to the end of the Word document?',
                              )
                            : tran(
                                  'Add the Bible text and the name and place details to the end of the printout?',
                              )}
                    </p>
                    <p
                        id="app-markdown-print-ask-counts"
                        className="app-markdown-print-ask-counts"
                    >
                        {countText}
                    </p>
                    <div className="app-markdown-print-ask-buttons">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={isReading}
                            // The answer a person asking this most likely
                            // wants: the details they were offered.
                            autoFocus
                            onClick={() => {
                                onAnswer('add');
                            }}
                        >
                            {isReading ? (
                                <span
                                    className="spinner-border spinner-border-sm"
                                    aria-hidden="true"
                                />
                            ) : (
                                <i className="bi bi-journal-plus" />
                            )}
                            {isWord
                                ? tran('Add and Export')
                                : tran('Add and Print')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={isReading}
                            onClick={() => {
                                onAnswer('without');
                            }}
                        >
                            {isWord
                                ? tran('Export Page Only')
                                : tran('Print Page Only')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={isReading}
                            onClick={() => {
                                onAnswer('cancel');
                            }}
                        >
                            {tran('Cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
