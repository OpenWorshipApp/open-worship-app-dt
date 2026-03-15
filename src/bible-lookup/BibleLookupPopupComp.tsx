import { useCallback } from 'react';

import { ModalComp } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { getIsKeepingPopup } from './RenderExtraButtonsRightComp';
import BibleReaderComp from '../bible-reader/BibleReaderComp';
import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';

export default function BibleLookupPopupComp() {
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);
    const handleLookupSaveBibleItem = useCallback(() => {
        const isKeepingPopup = getIsKeepingPopup();
        if (!isKeepingPopup) {
            hideBibleLookupPopup?.();
        }
    }, [hideBibleLookupPopup]);
    return (
        <ModalComp>
            <BibleReaderComp
                flexSizeName={resizeSettingNames.bibleLookupPopup}
                onLookupSaveBibleItem={handleLookupSaveBibleItem}
            />
        </ModalComp>
    );
}
