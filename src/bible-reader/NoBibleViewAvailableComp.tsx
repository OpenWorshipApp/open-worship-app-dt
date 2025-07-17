import { handleError } from '../helper/errorHelpers';
import { RECEIVING_DROP_CLASSNAME } from '../helper/helpers';
import {
    ReadIdOnlyBibleItem,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';

export default function NoBibleViewAvailableComp() {
    const viewController = useBibleItemsViewControllerContext();
    return (
        <div
            className="bible-view card flex-fill"
            style={{ minWidth: '30%' }}
            onDragOver={(event) => {
                event.preventDefault();
                event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
            }}
            onDrop={async (event) => {
                event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
                const data = event.dataTransfer.getData('text');
                try {
                    const json = JSON.parse(data);
                    if (json.type === 'bibleItem') {
                        const bibleItem = ReadIdOnlyBibleItem.fromJson(
                            json.data,
                        );
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
            '`No Bible Available'
        </div>
    );
}
