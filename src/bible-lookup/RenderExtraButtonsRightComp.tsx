import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { getSetting, useStateSettingBoolean } from '../helper/settingHelpers';
import {
    HelpButtonComp,
    QuitCurrentPageComp,
    SettingButtonComp,
} from '../others/commonButtons';
import appProvider from '../server/appProvider';
import { useAppCurrentRef } from '../helper/appHooks';

const CLOSE_ON_ADD_BIBLE_ITEM = 'close-on-add-bible-item';

export function getIsKeepingPopup() {
    if (appProvider.isPageReader) {
        return true;
    }
    return getSetting(CLOSE_ON_ADD_BIBLE_ITEM) === 'true';
}

export function AdvanceLookupHandlerComp({
    isAdvanceLookupOpened,
    handleToggleLookupOnline,
}: Readonly<{
    isAdvanceLookupOpened: boolean;
    handleToggleLookupOnline: () => void;
}>) {
    return (
        <button
            className={
                'btn btn-sm btn' +
                `-${isAdvanceLookupOpened ? '' : 'outline-'}info`
            }
            title={tran('Advance Bible Lookup')}
            onClick={handleToggleLookupOnline}
        >
            <i className="bi bi-search" />
        </button>
    );
}

export default function RenderExtraButtonsRightComp({
    setIsAdvanceLookupOpened,
    isAdvanceLookupOpened,
}: Readonly<{
    setIsAdvanceLookupOpened: (isAdvanceLookupOpened: boolean) => void;
    isAdvanceLookupOpened: boolean;
}>) {
    const [isKeepingPopup, setIsKeepingPopup] = useStateSettingBoolean(
        CLOSE_ON_ADD_BIBLE_ITEM,
        false,
    );
    const isKeepingPopupRef = useAppCurrentRef(isKeepingPopup);
    const setIsKeepingPopupRef = useAppCurrentRef(setIsKeepingPopup);
    const handleToggleKeepingPopup = useCallback(() => {
        setIsKeepingPopupRef.current(!isKeepingPopupRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCheckboxChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setIsKeepingPopupRef.current(checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const isAdvanceLookupOpenedRef = useAppCurrentRef(isAdvanceLookupOpened);
    const setIsAdvanceLookupOpenedRef = useAppCurrentRef(
        setIsAdvanceLookupOpened,
    );
    const handleToggleLookupOnline = useCallback(() => {
        setIsAdvanceLookupOpenedRef.current(!isAdvanceLookupOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex">
            {appProvider.isPagePresenter ||
            appProvider.isPageAppDocumentEditor ? (
                <div
                    className="input-group-text app-caught-hover-pointer"
                    title={tran(
                        'Keep popup modal open when adding a bible item, useful in presenter mode',
                    )}
                    onClick={handleToggleKeepingPopup}
                >
                    <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={isKeepingPopup}
                        onChange={handleCheckboxChange}
                    />
                    <span>{tran('Keep Open')}</span>
                </div>
            ) : null}
            <AdvanceLookupHandlerComp
                isAdvanceLookupOpened={isAdvanceLookupOpened}
                handleToggleLookupOnline={handleToggleLookupOnline}
            />
            {appProvider.isPageReader ? (
                <>
                    <QuitCurrentPageComp
                        title={tran('Go Back to Presenter')}
                        pathname={appProvider.presenterHomePage}
                    />
                    <SettingButtonComp />
                    <HelpButtonComp />
                </>
            ) : null}
        </div>
    );
}
