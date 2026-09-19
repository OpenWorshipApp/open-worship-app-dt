import { useCallback, useMemo } from 'react';
import { useAppCurrentRef } from '../helper/appHooks';

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
    return (
        <div
            className={`item alert app-caught-hover-pointer text-center ${selectedNS}`}
            data-verse-index={ind}
            title={
                `${verseNum}` === verseNumText ? undefined : `Verse ${verseNum}`
            }
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
        >
            <div className="number">{verseNumText}</div>
        </div>
    );
}
