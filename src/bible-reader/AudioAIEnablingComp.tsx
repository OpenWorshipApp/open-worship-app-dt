import type BibleItem from '../bible-list/BibleItem';
import {
    checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled,
} from '../helper/ai/openAIAudioHelpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export function AudioAIEnablingComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const { isAudioEnabled, isAvailable } = useIsAudioAIEnabled(bibleItem);
    const bibleItemViewController = useBibleItemsViewControllerContext();
    if (!isAvailable) {
        return null;
    }
    return (
        <i
            className="bi bi-soundwave app-caught-hover-pointer"
            style={{
                color: isAudioEnabled ? 'green' : '',
            }}
            onClick={async () => {
                const isAudioEnabled =
                    await checkIsAIAudioAvailableForBible(bibleItem);
                bibleItemViewController.applyTargetOrBibleKey(bibleItem, {
                    isAudioEnabled: !isAudioEnabled,
                });
            }}
        />
    );
}
