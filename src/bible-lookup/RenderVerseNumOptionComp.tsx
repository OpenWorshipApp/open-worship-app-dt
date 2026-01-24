import type BibleItem from '../bible-list/BibleItem';

let mouseDownInd: number | null = null;
export function mouseUp() {
    mouseDownInd = null;
}

export default function RenderVerseNumOptionComp({
    bibleItem,
    index,
    verseNum,
    verseNumText,
    onVerseChange,
}: Readonly<{
    bibleItem: BibleItem;
    index: number;
    verseNum: number;
    verseNumText: string;
    onVerseChange: (verseStart: number, verseEnd?: number) => void;
}>) {
    const { target } = bibleItem;
    const verseStart = target.verseStart;
    const verseEnd = target.verseEnd;
    const ind = index + 1;
    const started = verseStart === ind;
    const inside = verseStart <= ind && ind <= verseEnd;
    const ended = verseEnd === ind;
    let select = `${started ? 'selected-start' : ''}`;
    select += ` ${inside ? 'selected' : ''}`;
    select += ` ${ended ? 'selected-end' : ''}`;
    return (
        <div
            className={`item alert app-caught-hover-pointer text-center ${select}`}
            title={
                `${verseNum}` === verseNumText ? undefined : `Verse ${verseNum}`
            }
            onMouseDown={(event) => {
                if (event.shiftKey) {
                    const arr = [ind, verseStart, verseEnd].sort((a, b) => {
                        return a - b;
                    });
                    const verse = arr.shift();
                    if (verse === undefined) {
                        return;
                    }
                    onVerseChange(verse, arr.pop());
                } else {
                    onVerseChange(ind);
                    mouseDownInd = ind;
                }
            }}
            onMouseEnter={() => {
                if (mouseDownInd !== null) {
                    onVerseChange(
                        Math.min(mouseDownInd, ind),
                        Math.max(mouseDownInd, ind),
                    );
                }
            }}
        >
            <span>{verseNumText}</span>
        </div>
    );
}
