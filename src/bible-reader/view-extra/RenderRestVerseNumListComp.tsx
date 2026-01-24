import { useMemo } from 'react';

import { useBibleViewFontSizeContext } from '../../helper/bibleViewHelpers';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import { toLocaleNumBible } from '../../helper/bible-helpers/bibleLogicHelpers2';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { cleanupVerseNumberClicked } from './viewExtraHelpers';

export default function RenderRestVerseNumListComp({
    to,
    from,
    bibleItem,
    verseCount,
    onSelect,
    toTitle,
}: Readonly<{
    to?: number;
    from?: number;
    bibleItem: ReadIdOnlyBibleItem;
    verseCount: number;
    onSelect: (verse: number) => void;
    toTitle: (verse: number) => string;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    const actualFrom = from ?? 1;
    const actualTo = to ?? verseCount;
    const numList = useMemo(() => {
        const list = [];
        for (let i = actualFrom; i <= actualTo; i++) {
            list.push(i);
        }
        return list;
    }, [actualFrom, actualTo]);
    const [localeVerseList] = useAppStateAsync(() => {
        return Promise.all(
            numList.map((verse) => {
                return toLocaleNumBible(bibleItem.bibleKey, verse);
            }),
        );
    }, [bibleItem.bibleKey, numList]);
    if (!localeVerseList || localeVerseList.length === 0) {
        return null;
    }
    return (
        <div className="app-not-selectable-text">
            {numList.map((verse, i) => {
                return (
                    <div
                        key={verse}
                        className="verse-number app-caught-hover-pointer"
                        title={`Double click to select verses ${toTitle(verse)}`}
                        onDoubleClick={(event) => {
                            cleanupVerseNumberClicked(event);
                            onSelect(verse);
                        }}
                    >
                        <div
                            className="verse-number-rest app-not-selectable-text"
                            style={{
                                fontSize: `${fontSize * 0.7}px`,
                            }}
                            data-bible-key={bibleItem.bibleKey}
                        >
                            {localeVerseList[i]}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
