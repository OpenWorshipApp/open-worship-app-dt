import { useBibleViewFontSizeContext } from '../../helper/bibleViewHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { cleanupVerseNumberClicked } from './viewExtraHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { tran } from '../../lang/langHelpers';

export type RestVerseType = {
    verse: number;
    // The number as the bible writes it (Khmer digits for a Khmer bible).
    label: string | number | null;
};

/**
 * The verse numbers outside the passage. Handed in already written out --
 * the passage view reads them with its verses -- because worked out here,
 * one load behind, a move to another passage drew the new numbers' slots
 * with the OLD passage's labels until that load landed.
 */
export default function RenderRestVerseNumListComp({
    bibleItem,
    restVerseList,
    onSelect,
    toTitle,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    restVerseList: RestVerseType[];
    onSelect: (verse: number) => void;
    toTitle: (verse: number) => string;
}>) {
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    const fontSize = useBibleViewFontSizeContext();
    if (restVerseList.length === 0) {
        return null;
    }
    return (
        <div className="app-not-selectable-text">
            {restVerseList.map(({ verse, label }) => {
                return (
                    <div
                        key={verse}
                        className="verse-number app-caught-hover-pointer"
                        title={
                            tran('Double click to select verses') +
                            ` ${toTitle(verse)}`
                        }
                        onDoubleClick={(event) => {
                            cleanupVerseNumberClicked(event);
                            onSelect(verse);
                        }}
                    >
                        <div
                            className="verse-number-rest app-not-selectable-text"
                            style={{
                                fontSize: `${fontSize * 0.7}px`,
                                fontFamily,
                            }}
                        >
                            {label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
