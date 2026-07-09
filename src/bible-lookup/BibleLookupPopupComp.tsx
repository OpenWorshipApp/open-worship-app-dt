import { useCallback } from 'react';

import { ModalComp } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { getIsKeepingPopup } from './RenderExtraButtonsRightComp';
import BibleReaderComp from '../bible-reader/BibleReaderComp';
import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function BibleLookupPopupComp() {
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);
    const hideBibleLookupPopupRef = useAppCurrentRef(hideBibleLookupPopup);
    const handleLookupSaveBibleItem = useCallback(() => {
        const isKeepingPopup = getIsKeepingPopup();
        if (!isKeepingPopup) {
            hideBibleLookupPopupRef.current?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <ModalComp>
            <BibleReaderComp
                flexSizeName={resizeSettingNames.bibleLookupPopup}
                onLookupSaveBibleItem={handleLookupSaveBibleItem}
            />
        </ModalComp>
    );
}
