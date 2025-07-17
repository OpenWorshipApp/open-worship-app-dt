import './BibleLookupPopupComp.scss';

import { useMemo } from 'react';

import RenderBibleLookupComp from './RenderBibleLookupComp';
import { ModalComp } from '../app-modal/ModalComp';
import LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { BibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { getIsKeepingPopup } from './RenderExtraButtonsRightComp';

export default function BibleLookupPopupComp() {
    const hideBibleLookupPopup = useToggleBibleLookupPopupContext(false);
    const viewController = useMemo(() => {
        const newViewController = new LookupBibleItemController();
        newViewController.onLookupSaveBibleItem = () => {
            const isKeepingPopup = getIsKeepingPopup();
            if (!isKeepingPopup) {
                hideBibleLookupPopup?.();
            }
        };
        return newViewController;
    }, []);
    return (
        <ModalComp>
            <BibleItemsViewControllerContext value={viewController}>
                <RenderBibleLookupComp />
            </BibleItemsViewControllerContext>
        </ModalComp>
    );
}
