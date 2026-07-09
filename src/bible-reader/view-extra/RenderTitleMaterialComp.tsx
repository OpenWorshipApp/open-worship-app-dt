import { useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import { BibleKeySelectionMiniComp } from '../../bible-lookup/BibleKeySelectionComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import type ColorNoteInf from '../../helper/ColorNoteInf';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { AudioAIEnablingComp } from '../AudioAIEnablingComp';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { useBibleViewTitleMaterialContext } from './viewExtraHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleLogicHelpers2';
import { useAppCurrentRef } from '../../helper/appHooks';

function RenderBibleKeyComp({
    bibleKey,
    bibleItem,
}: Readonly<{ bibleKey: string; bibleItem: ReadIdOnlyBibleItem }>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const viewController = useBibleItemsViewControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const handleClicking = useCallback(() => {
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            extraBibleKeys: bibleItemRef.current.extraBibleKeys.filter(
                (key) => key !== bibleKeyRef.current,
            ),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <span
            className="bible-extra-key bg-primary small app-caught-hover-pointer"
            title={`Click to remove extra Bible ${bibleKey}`}
            key={bibleKey}
            style={{
                borderRadius: '8px',
                fontSize: '10px',
                padding: '2px',
                margin: 'auto 1px',
                fontFamily,
            }}
            onClick={handleClicking}
        >
            <i className="bi bi-x" style={{ color: 'red' }} />
            {bibleKey}
        </span>
    );
}

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
                <div className="ms-1">
                    <ItemColorNoteComp item={colorNoteHandler} />
                </div>
                <div className="mx-1">
                    <AudioAIEnablingComp bibleItem={bibleItem} />
                </div>
            </div>
            <div className="d-flex flex-fill">
                <div className="d-flex ps-1">
                    <div style={{ margin: 'auto' }}>
                        <BibleKeySelectionMiniComp
                            bibleKey={bibleItem.bibleKey}
                            onBibleKeyChange={onBibleKeyChange}
                            contextMenuTitle={tran('Add Extra Bible')}
                        />
                    </div>
                    {bibleItem.extraBibleKeys.map((extraBibleKey) => (
                        <RenderBibleKeyComp
                            key={extraBibleKey}
                            bibleKey={extraBibleKey}
                            bibleItem={bibleItem}
                        />
                    ))}
                </div>
                <div className="app-flex-item">
                    {materialContext.titleElement}
                </div>
            </div>
        </div>
    );
}
