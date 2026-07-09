import { useCallback } from 'react';

import type Bible from './Bible';
import BibleItemRenderComp from './BibleItemRenderComp';
import { genDuplicatedMessage } from './bibleItemHelpers';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderBibleItemsComp({
    bible,
}: Readonly<{
    bible: Bible;
}>) {
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
    const items = bible.items;
    const shouldAddBibleItem = bible.isDefault && showBibleLookupPopup !== null;
    const showBibleLookupPopupRef = useAppCurrentRef(showBibleLookupPopup);
    const handleAddBibleItem = useCallback(() => {
        showBibleLookupPopupRef.current?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <ul
            className="list-group"
            style={{
                minWidth: '220px',
                maxWidth: '420px',
            }}
        >
            {items.map((bibleItem, i1) => {
                return (
                    <BibleItemRenderComp
                        key={`${bibleItem.id}`}
                        index={i1}
                        warningMessage={genDuplicatedMessage(
                            items,
                            bibleItem,
                            i1,
                        )}
                        bibleItem={bibleItem}
                        filePath={bible.filePath}
                    />
                );
            })}
            {shouldAddBibleItem && (
                <button
                    type="button"
                    className={
                        'btn btn-sm btn-labeled btn-primary p-2 my-1 ' +
                        'pointer app-border-white-round'
                    }
                    style={{
                        margin: 'auto',
                        fontSize: '0.8rem',
                    }}
                    onClick={handleAddBibleItem}
                >
                    <i className="bi bi-book px-1" />
                    {' ' + tran('Add Bible Item')}
                </button>
            )}
        </ul>
    );
}
