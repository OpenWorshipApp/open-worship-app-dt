import './BibleLookupPopupComp.scss';

import { ModalComp } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { getIsKeepingPopup } from './RenderExtraButtonsRightComp';
import BibleReaderComp from '../BibleReaderComp';
import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';

export default function BibleLookupPopupComp() {
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);
    return (
        <ModalComp>
            <BibleReaderComp
                flexSizeName={resizeSettingNames.bibleLookupPopup}
                onLookupSaveBibleItem={() => {
                    const isKeepingPopup = getIsKeepingPopup();
                    if (!isKeepingPopup) {
                        hideBibleLookupPopup?.();
                    }
                }}
            />
        </ModalComp>
    );
}
