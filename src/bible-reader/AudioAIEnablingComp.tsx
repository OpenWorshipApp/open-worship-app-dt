import BibleItem from '../bible-list/BibleItem';
import { useLookupBibleItemControllerContext } from './LookupBibleItemController';

export function AudioAIEnablingComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const lookupBibleItemController = useLookupBibleItemControllerContext();
    return (
        <i
            className="bi bi-soundwave app-caught-hover-pointer"
            style={{
                color: bibleItem.isAudioEnabled ? 'green' : '',
            }}
            onClick={async () => {
                lookupBibleItemController.applyTargetOrBibleKey(bibleItem, {
                    isAudioEnabled: !bibleItem.isAudioEnabled,
                });
            }}
        />
    );
}
