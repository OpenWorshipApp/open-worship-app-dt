import { useCallback } from 'react';

import InputHandlerComp from './InputHandlerComp';
import RenderExtraButtonsRightComp, {
    AdvanceLookupHandlerComp,
} from './RenderExtraButtonsRightComp';
import BibleLookupInputHistoryComp from './BibleLookupInputHistoryComp';
import appProvider from '../server/appProvider';
import { ModalCloseButtonComp } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import RenderOpenWikiDictionaryComp from './RenderOpenWikiDictionaryComp';
import RenderExportWordComp from './RenderExportWordComp';
import { useAppCurrentRef } from '../helper/appHooks';
import LocationNameLookupToggleComp from '../location-name-lookup/LocationNameLookupToggleComp';
import PreviewFullSizeButtonComp from './PreviewFullSizeButtonComp';

// The history strip beside the input group is sized against half of this, and
// `.app-input-group-header` in `BibleReaderComp.scss` caps it at the same value
// — change all three together.
const INPUT_GROUP_WIDTH = 395;

export default function RenderBibleLookupHeaderComp({
    flexSizeName,
    sideWidgetKeys,
    toggleAdvanceLookup,
    isAdvanceLookupOpened,
}: Readonly<{
    flexSizeName: string;
    // The leading side panes (the Bible and Notes sidebar) plus the Advance
    // Lookup pane, i.e. everything the full-size preview button collapses.
    sideWidgetKeys: string[];
    toggleAdvanceLookup: () => void;
    isAdvanceLookupOpened: boolean;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);

    const viewControllerRef = useAppCurrentRef(viewController);
    const handleBibleKeyChanging = useCallback(
        async (_oldBibleKey: string, newBibleKey: string) => {
            viewControllerRef.current.applyTargetOrBibleKey(
                viewControllerRef.current.selectedBibleItem,
                {
                    bibleKey: newBibleKey,
                },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div
            className="card-header d-flex w-100 p-0 overflow-hidden align-items-center"
            style={{
                height: '38px',
            }}
        >
            {viewController.isMinimized ? null : (
                <div
                    className="app-flex-item h-100 overflow-hidden d-flex align-items-center"
                    style={{
                        width: `calc(50% - ${INPUT_GROUP_WIDTH / 2}px)`,
                        // Gives way first (down to `.app-flex-item`'s 120px)
                        // when the header is short of room. Shrinking in step
                        // with everything else, at ~925px it left the lookup's
                        // own buttons -- Keep Open, Word, notes -- running off
                        // the end of their strip, one icon half shown.
                        flexShrink: 100,
                    }}
                >
                    <BibleLookupInputHistoryComp />
                </div>
            )}
            <div className="mx-1">
                <PreviewFullSizeButtonComp
                    flexSizeName={flexSizeName}
                    sideWidgetKeys={sideWidgetKeys}
                />
            </div>
            <div
                className="app-flex-item input-group app-input-group-header"
                style={{ width: INPUT_GROUP_WIDTH }}
            >
                <InputHandlerComp onBibleKeyChange={handleBibleKeyChanging} />
            </div>
            <div className="mx-1">
                <LocationNameLookupToggleComp />
            </div>
            {viewController.isMinimized ? (
                <div className="mx-2">
                    <AdvanceLookupHandlerComp
                        isAdvanceLookupOpened={isAdvanceLookupOpened}
                        handleToggleLookupOnline={toggleAdvanceLookup}
                    />
                </div>
            ) : (
                <>
                    <div
                        className={
                            'app-flex-item flex-fill justify-content-end' +
                            ' align-items-center' +
                            (appProvider.isPageReader ? '' : ' pe-5')
                        }
                    >
                        <RenderExtraButtonsRightComp
                            toggleAdvanceLookup={toggleAdvanceLookup}
                            isAdvanceLookupOpened={isAdvanceLookupOpened}
                        >
                            <RenderExportWordComp />
                            <RenderOpenWikiDictionaryComp />
                        </RenderExtraButtonsRightComp>
                    </div>
                    {hideBibleLookupPopup === null ? null : (
                        <ModalCloseButtonComp
                            close={() => {
                                hideBibleLookupPopup();
                            }}
                        />
                    )}
                </>
            )}
        </div>
    );
}
