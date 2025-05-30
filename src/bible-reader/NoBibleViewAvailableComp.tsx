import BibleItem from '../bible-list/BibleItem';
import { handleError } from '../helper/errorHelpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export default function NoBibleViewAvailableComp() {
    const viewController = useBibleItemsViewControllerContext();
    return (
        <div
            className="bible-view card flex-fill"
            style={{ minWidth: '30%' }}
            onDragOver={(event) => {
                event.preventDefault();
                event.currentTarget.classList.add('receiving-child');
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('receiving-child');
            }}
            onDrop={async (event) => {
                event.currentTarget.classList.remove('receiving-child');
                const data = event.dataTransfer.getData('text');
                try {
                    const json = JSON.parse(data);
                    if (json.type === 'bibleItem') {
                        const bibleItem = BibleItem.fromJson(json.data);
                        viewController.addBibleItem(
                            null,
                            bibleItem,
                            false,
                            false,
                            false,
                        );
                    }
                } catch (error) {
                    handleError(error);
                }
            }}
        >
            '`' + 'No Bible Available'
        </div>
    );
}
