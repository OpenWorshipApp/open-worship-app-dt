import { useCallback, type MouseEvent } from 'react';

import type Bible from './Bible';
import BibleItemRenderComp from './BibleItemRenderComp';
import { genDuplicatedMessage } from './bibleItemHelpers';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genAddBibleItemContextMenu } from '../helper/ai/bibleListChatbotMenuHelpers';

export default function RenderBibleItemsComp({
    bible,
}: Readonly<{
    bible: Bible;
}>) {
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
    const items = bible.items;
    const shouldAddBibleItem = bible.isDefault && showBibleLookupPopup !== null;
    const showBibleLookupPopupRef = useAppCurrentRef(showBibleLookupPopup);
    // The lookup, or the chatbot with a text to read the passages from
    // (EC-760): a menu while AI is on, the lookup at once while it is off.
    const handleAddBibleItem = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const openBibleLookup = () => {
                showBibleLookupPopupRef.current?.();
            };
            const menuItems = genAddBibleItemContextMenu(openBibleLookup);
            if (menuItems === null) {
                openBibleLookup();
                return;
            }
            // Hung under the button: a press from the keyboard carries no
            // coordinates, and the menu would open in the window's corner.
            const { left, bottom } =
                event.currentTarget.getBoundingClientRect();
            showAppContextMenu(event as any, menuItems, {
                coord: { x: left, y: bottom },
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <ul className="list-group">
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
