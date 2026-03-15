import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { handleError } from '../helper/errorHelpers';
import { RECEIVING_DROP_CLASSNAME } from '../helper/helpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

export default function NoBibleViewAvailableComp() {
    const viewController = useBibleItemsViewControllerContext();
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDrop = useCallback(
        async (event: any) => {
            event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
            const data = event.dataTransfer.getData('text');
            try {
                const json = JSON.parse(data);
                if (json.type === 'bibleItem') {
                    const bibleItem = ReadIdOnlyBibleItem.fromJson(json.data);
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
        },
        [viewController],
    );
    return (
        <div
            className="bible-view card flex-fill"
            style={{ minWidth: '30%' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {tran('No Bible Available')}
        </div>
    );
}
