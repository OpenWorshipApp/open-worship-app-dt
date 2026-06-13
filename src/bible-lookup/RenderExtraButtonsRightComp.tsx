import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { getSetting, useStateSettingBoolean } from '../helper/settingHelpers';
import {
    HelpButtonComp,
    QuitCurrentPageComp,
    SettingButtonComp,
} from '../others/commonButtons';
import appProvider from '../server/appProvider';

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
    const handleToggleKeepingPopup = useCallback(() => {
        setIsKeepingPopup(!isKeepingPopup);
    }, [isKeepingPopup, setIsKeepingPopup]);
    const handleCheckboxChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setIsKeepingPopup(checked);
        },
        [setIsKeepingPopup],
    );
    const handleToggleLookupOnline = useCallback(() => {
        setIsAdvanceLookupOpened(!isAdvanceLookupOpened);
    }, [isAdvanceLookupOpened, setIsAdvanceLookupOpened]);
    return (
        <div className="d-flex">
            {appProvider.isPagePresenter ? (
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
