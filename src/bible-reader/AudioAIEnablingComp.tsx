import BibleItem from '../bible-list/BibleItem';
import { useAISetting } from '../helper/openAIHelpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export function AudioAIEnablingComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const bibleItemViewController = useBibleItemsViewControllerContext();
    const aiSetting = useAISetting();
    if (!aiSetting.openAIAPIKey) {
        return null;
    }
    return (
        <i
            className="bi bi-soundwave app-caught-hover-pointer"
            style={{
                color: bibleItem.isAudioEnabled ? 'green' : '',
            }}
            onClick={async () => {
                bibleItemViewController.applyTargetOrBibleKey(bibleItem, {
                    isAudioEnabled: !bibleItem.isAudioEnabled,
                });
            }}
        />
    );
}
