import type BibleItem from '../bible-list/BibleItem';
import type { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import { BibleKeySelectionMiniComp } from '../bible-lookup/BibleKeySelectionComp';
import { useAppStateAsync } from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';

function RenderVerseTextComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const [text] = useAppStateAsync(() => {
        return bibleItem.toText();
    }, [bibleItem]);
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    return (
        <div
            className="p-1"
            style={{
                maxHeight: '75px',
                overflow: 'auto',
                fontFamily,
            }}
        >
            {text}
        </div>
    );
}

/**
 * The verse a side panel is currently working from: its version chip, its
 * editable reference, and its text.
 *
 * ONE component rather than one per panel. Cross Reference and Resources both
 * answer "what do I have for THIS verse", so the block that names the verse has
 * to look and behave identically in both -- a copy would drift the moment one
 * of them is restyled. What each panel keeps for itself is what a change MEANS:
 * the callbacks decide which item gets cloned and how, which is not the same in
 * a panel that renders a verse of a range as in one that holds a single verse.
 */
export default function SelectedBibleVerseHeaderComp({
    bibleItem,
    onBibleKeyChange,
    onTargetChange,
}: Readonly<{
    bibleItem: BibleItem;
    onBibleKeyChange: (bibleKey: string) => void;
    onTargetChange: (bibleTarget: BibleTargetType) => void;
}>) {
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    return (
        <div className="m-1 p-1" style={{ fontFamily }}>
            <div
                className="alert alert-info p-0 px-1 m-0"
                style={{ verticalAlign: 'center' }}
            >
                <BibleKeySelectionMiniComp
                    bibleKey={bibleItem.bibleKey}
                    onBibleKeyChange={(_isContextMenu, _oldValue, newValue) => {
                        onBibleKeyChange(newValue);
                    }}
                />
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    isOneVerse
                    onTargetChange={onTargetChange}
                    waitUntilGotVerseStart
                />
            </div>
            <RenderVerseTextComp bibleItem={bibleItem} />
        </div>
    );
}
