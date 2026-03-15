import { useCallback, useMemo } from 'react';

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
    const handleMouseDown = useCallback(
        (event: any) => {
            if (event.shiftKey) {
                const arr = [ind, verseStart, verseEnd].sort((a, b) => {
                    return a - b;
                });
                const verse = arr.shift();
                if (verse === undefined) {
                    return;
                }
                onApply(verse, arr.pop());
                mouseDownObj = null;
                return;
            }
            onVerseChange(ind);
            mouseDownObj = {
                indStart: ind,
                indEnd: ind,
                onMouseUp: () => {
                    onApply(...genVerseObject());
                    mouseDownObj = null;
                },
            };
        },
        [ind, verseStart, verseEnd, onVerseChange, onApply],
    );
    const handleMouseEnter = useCallback(() => {
        if (mouseDownObj === null) {
            return;
        }
        mouseDownObj.indEnd = ind;
        onVerseChange(...genVerseObject());
    }, [ind, onVerseChange]);
    return (
        <div
            className={`item alert app-caught-hover-pointer text-center ${selectedNS}`}
            title={
                `${verseNum}` === verseNumText ? undefined : `Verse ${verseNum}`
            }
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
        >
            <span>{verseNumText}</span>
        </div>
    );
}
