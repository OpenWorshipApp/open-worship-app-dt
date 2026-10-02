import type BibleItem from '../bible-list/BibleItem';
import {
    checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled,
} from '../helper/ai/openAIAudioHelpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import { pressElementLikeButton } from '../helper/helpers';
import { tran } from '../lang/langHelpers';

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
            // A bare icon you could only click: no keyboard reached it and a
            // screen reader neither named it nor said whether it was on.
            role="button"
            tabIndex={0}
            title={tran('Toggle Bible Audio')}
            aria-label={tran('Toggle Bible Audio')}
            aria-pressed={isAudioEnabled}
            onKeyDown={pressElementLikeButton}
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
