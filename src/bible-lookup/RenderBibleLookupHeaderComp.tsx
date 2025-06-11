import InputHandlerComp from './InputHandlerComp';
import RenderExtraButtonsRightComp from './RenderExtraButtonsRightComp';
import InputHistoryComp from './InputHistoryComp';
import appProvider from '../server/appProvider';
import { ModalCloseButton } from '../app-modal/ModalComp';
import { useShowBibleLookupContext } from '../others/commonButtons';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';

export default function RenderBibleLookupHeaderComp({
    isLookupOnline,
    setIsLookupOnline,
}: Readonly<{
    isLookupOnline: boolean;
    setIsLookupOnline: (isLookupOnline: boolean) => void;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const hideBibleLookupPopup = useShowBibleLookupContext(false);

    const handleBibleKeyChanging = async (
        _oldBibleKey: string,
        newBibleKey: string,
    ) => {
        viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
            bibleKey: newBibleKey,
        });
    };
    return (
        <div className="card-header d-flex text-center w-100">
            <div
                className="flex-item"
                style={{
                    width: 'calc(50% - 175px)',
                }}
            >
                <InputHistoryComp />
            </div>
            <div
                className="flex-item input-group app-input-group-header"
                style={{ width: 350 }}
            >
                <InputHandlerComp onBibleKeyChange={handleBibleKeyChanging} />
            </div>
            <div
                className={
                    'flex-item flex-fill justify-content-end' +
                    (!appProvider.isPageReader ? ' pe-5' : '')
                }
            >
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
