import InputHandlerComp from './InputHandlerComp';
import RenderExtraButtonsRightComp from './RenderExtraButtonsRightComp';
import BibleLookupInputHistoryComp from './BibleLookupInputHistoryComp';
import appProvider from '../server/appProvider';
import { ModalCloseButton } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { AIConfigComp } from '../bible-reader/AIConfigComp';
import RenderOpenWikiDictionaryComp from './RenderOpenWikiDictionaryComp';
import RenderExportWordComp from './RenderExportWordComp';

export default function RenderBibleLookupHeaderComp({
    isLookupOnline,
    setIsLookupOnline,
}: Readonly<{
    isLookupOnline: boolean;
    setIsLookupOnline: (isLookupOnline: boolean) => void;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);

    const handleBibleKeyChanging = async (
        _oldBibleKey: string,
        newBibleKey: string,
    ) => {
        viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
            bibleKey: newBibleKey,
        });
    };
    return (
        <div
            className="card-header d-flex w-100 p-0 overflow-hidden align-items-center"
            style={{
                height: '38px',
            }}
        >
            <div
                className="flex-item h-100 overflow-hidden d-flex align-items-center"
                style={{
                    width: 'calc(50% - 175px)',
                }}
            >
                <BibleLookupInputHistoryComp />
            </div>
            <div
                className="flex-item input-group app-input-group-header"
                style={{ width: 350 }}
            >
                <InputHandlerComp onBibleKeyChange={handleBibleKeyChanging} />
            </div>
            <div className="mx-2">
                <AIConfigComp />
            </div>
            <div
                className={
                    'flex-item flex-fill justify-content-end' +
                    (appProvider.isPageReader ? '' : ' pe-5')
                }
            >
                <RenderExportWordComp />
                <RenderOpenWikiDictionaryComp />
                <div className="float-start">
                    <RenderExtraButtonsRightComp
                        setIsLookupOnline={setIsLookupOnline}
                        isLookupOnline={isLookupOnline}
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
        </div>
    );
}
