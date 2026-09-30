import { useCallback, useMemo } from 'react';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

let mouseDownObj: {
    indStart: number;
    indEnd: number;
    onMouseUp: () => void;
} | null = null;
export function mouseUp() {
    mouseDownObj?.onMouseUp();
}

function genVerseObject(): [number, number] {
    const { indStart, indEnd } = mouseDownObj!;
    return [Math.min(indStart, indEnd), Math.max(indStart, indEnd)];
}
export default function RenderVerseNumOptionComp({
    index,
    verseNum,
    verseNumText,
    verseStart,
    verseEnd,
    onVerseChange,
    onApply,
}: Readonly<{
    index: number;
    verseNum: number;
    verseNumText: string;
    verseStart: number;
    verseEnd: number;
    onVerseChange: (verseStart: number, verseEnd?: number) => void;
    onApply: (verseStart: number, verseEnd?: number) => void;
}>) {
    const { selectedNS, ind } = useMemo(() => {
        const ind = index + 1;
        const started = verseStart === ind;
        const isInside = verseStart <= ind && ind <= verseEnd;
        const ended = verseEnd === ind;
        let selectedNS = `${started ? 'selected-start' : ''}`;
        selectedNS += ` ${isInside ? 'selected' : ''}`;
        selectedNS += ` ${ended ? 'selected-end' : ''}`;
        return { selectedNS, ind };
    }, [index, verseStart, verseEnd]);
    const indRef = useAppCurrentRef(ind);
    const verseStartRef = useAppCurrentRef(verseStart);
    const verseEndRef = useAppCurrentRef(verseEnd);
    const onVerseChangeRef = useAppCurrentRef(onVerseChange);
    const onApplyRef = useAppCurrentRef(onApply);
    const handleMouseDown = useCallback((event: any) => {
        if (event.shiftKey) {
            const arr = [
                indRef.current,
                verseStartRef.current,
                verseEndRef.current,
            ].sort((a, b) => {
                return a - b;
            });
            const verse = arr.shift();
            if (verse === undefined) {
                return;
            }
            onApplyRef.current(verse, arr.pop());
            mouseDownObj = null;
            return;
        }
        onVerseChangeRef.current(indRef.current);
        mouseDownObj = {
            indStart: indRef.current,
            indEnd: indRef.current,
            onMouseUp: () => {
                onApplyRef.current(...genVerseObject());
                mouseDownObj = null;
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMouseEnter = useCallback(() => {
        if (mouseDownObj === null) {
            return;
        }
        mouseDownObj.indEnd = indRef.current;
        onVerseChangeRef.current(...genVerseObject());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A keypress has no mouseup of its own, so it opens and closes the same
    // drag the mouse does — which is what keeps Shift+Enter extending a range
    // exactly as Shift-click does, out of one implementation.
    const handleKeyDown = useCallback(
        (event: any) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            // Space would scroll the options list out from under the caret.
            event.preventDefault();
            handleMouseDown(event);
            mouseUp();
        },
        [handleMouseDown],
    );
    return (
        // This grid is THE way to pick a passage, and it was a bare `div` with
        // mouse handlers: no role, no tab stop, and a `title` only when the
        // numerals are non-ASCII — so in an English bible it was invisible to
        // assistive tech and unreachable by keyboard, while the book options
        // beside it are real buttons.
        <div
            className={`item alert app-caught-hover-pointer text-center ${selectedNS}`}
            data-verse-index={ind}
            role="button"
            tabIndex={0}
            aria-label={`${tran('Verse')} ${verseNum}`}
            title={
                `${verseNum}` === verseNumText
                    ? undefined
                    : `${tran('Verse')} ${verseNum}`
            }
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onKeyDown={handleKeyDown}
        >
            <div className="number">{verseNumText}</div>
        </div>
    );
}
