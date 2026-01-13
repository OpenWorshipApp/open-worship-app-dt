import { tran } from '../../lang/langHelpers';
import { BibleSelectionMiniComp } from '../../bible-lookup/BibleSelectionComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import ColorNoteInf from '../../helper/ColorNoteInf';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { AudioAIEnablingComp } from '../AudioAIEnablingComp';
import { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { useBibleViewTitleMaterialContext } from './viewExtraHelpers';

export function RenderTitleMaterialComp({
    bibleItem,
    onBibleKeyChange,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    onBibleKeyChange?: (
        isContextMenu: boolean,
        oldBibleKey: string,
        newBibleKey: string,
    ) => void;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const materialContext = useBibleViewTitleMaterialContext();
    const colorNoteHandler: ColorNoteInf = {
        getColorNote: async () => {
            return viewController.getColorNote(bibleItem);
        },
        setColorNote: async (color) => {
            viewController.setColorNote(bibleItem, color);
        },
    };
    return (
        <div
            className="d-flex text-nowrap w-100 h-100"
            style={{
                overflowX: 'auto',
            }}
        >
            <div className="d-flex">
                <div>
                    <ItemColorNoteComp item={colorNoteHandler} />
                </div>
                <div className="mx-1">
                    <AudioAIEnablingComp bibleItem={bibleItem} />
                </div>
            </div>
            <div className="d-flex flex-fill">
                <div className="d-flex ps-1">
                    <div style={{ margin: 'auto' }}>
                        <BibleSelectionMiniComp
                            bibleKey={bibleItem.bibleKey}
                            onBibleKeyChange={onBibleKeyChange}
                            contextMenuTitle={tran('Add Extra Bible')}
                        />
                    </div>
                    {bibleItem.extraBibleKeys.map((extraBibleKey) => (
                        <span
                            className="bible-extra-key bg-primary small app-caught-hover-pointer"
                            title={`Click to remove extra Bible ${extraBibleKey}`}
                            data-bible-key={extraBibleKey}
                            key={extraBibleKey}
                            style={{
                                borderRadius: '8px',
                                fontSize: '10px',
                                padding: '2px',
                                margin: 'auto 1px',
                            }}
                            onClick={() => {
                                viewController.applyTargetOrBibleKey(
                                    bibleItem,
                                    {
                                        extraBibleKeys:
                                            bibleItem.extraBibleKeys.filter(
                                                (key) => key !== extraBibleKey,
                                            ),
                                    },
                                );
                            }}
                        >
                            <i className="bi bi-x" style={{ color: 'red' }} />
                            {extraBibleKey}
                        </span>
                    ))}
                </div>
                <div className="flex-item">{materialContext.titleElement}</div>
            </div>
        </div>
    );
}
