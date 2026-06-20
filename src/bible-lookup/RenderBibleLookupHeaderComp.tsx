import { useCallback } from 'react';

import InputHandlerComp from './InputHandlerComp';
import RenderExtraButtonsRightComp, {
    AdvanceLookupHandlerComp,
} from './RenderExtraButtonsRightComp';
import BibleLookupInputHistoryComp from './BibleLookupInputHistoryComp';
import appProvider from '../server/appProvider';
import { ModalCloseButton } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { AIConfigComp } from '../bible-reader/AIConfigComp';
import RenderOpenWikiDictionaryComp from './RenderOpenWikiDictionaryComp';
import RenderExportWordComp from './RenderExportWordComp';

export default function RenderBibleLookupHeaderComp({
    setIsAdvanceLookupOpened,
    isAdvanceLookupOpened,
}: Readonly<{
    setIsAdvanceLookupOpened: (isAdvanceLookupOpened: boolean) => void;
    isAdvanceLookupOpened: boolean;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);

    const handleBibleKeyChanging = useCallback(
        async (_oldBibleKey: string, newBibleKey: string) => {
            viewController.applyTargetOrBibleKey(
                viewController.selectedBibleItem,
                {
                    bibleKey: newBibleKey,
                },
            );
        },
        [viewController],
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
                        width: 'calc(50% - 175px)',
                    }}
                >
                    <BibleLookupInputHistoryComp />
                </div>
            )}
            <div
                className="app-flex-item input-group app-input-group-header"
                style={{ width: 350 }}
            >
                <InputHandlerComp onBibleKeyChange={handleBibleKeyChanging} />
            </div>
            {viewController.isMinimized ? (
                <div className="mx-2">
                    <AdvanceLookupHandlerComp
                        isAdvanceLookupOpened={isAdvanceLookupOpened}
                        handleToggleLookupOnline={() =>
                            setIsAdvanceLookupOpened(!isAdvanceLookupOpened)
                        }
                    />
                </div>
            ) : (
                <>
                    <div className="mx-2">
                        <AIConfigComp />
                    </div>
                    <div
                        className={
                            'app-flex-item flex-fill justify-content-end' +
                            (appProvider.isPageReader ? '' : ' pe-5')
                        }
                    >
                        <RenderExportWordComp />
                        <RenderOpenWikiDictionaryComp />
                        <div className="float-start">
                            <RenderExtraButtonsRightComp
                                setIsAdvanceLookupOpened={
                                    setIsAdvanceLookupOpened
                                }
                                isAdvanceLookupOpened={isAdvanceLookupOpened}
                            />
                        </div>
                    </div>
                    {hideBibleLookupPopup === null ? null : (
                        <ModalCloseButton
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
