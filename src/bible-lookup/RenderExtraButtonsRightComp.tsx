import { getSetting, useStateSettingBoolean } from '../helper/settingHelpers';
import {
    QuickOrBackButtonComp,
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

export default function RenderExtraButtonsRightComp({
    setIsLookupOnline,
    isLookupOnline,
}: Readonly<{
    setIsLookupOnline: (_: boolean) => void;
    isLookupOnline: boolean;
}>) {
    const [isKeepingPopup, setIsKeepingPopup] = useStateSettingBoolean(
        CLOSE_ON_ADD_BIBLE_ITEM,
        false,
    );
    return (
        <div className="d-flex">
            {appProvider.isPagePresenter ? (
                <div
                    className="input-group-text app-caught-hover-pointer"
                    onClick={() => {
                        setIsKeepingPopup(!isKeepingPopup);
                    }}
                >
                    <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={isKeepingPopup}
                        onChange={(event) => {
                            const checked = event.target.checked;
                            setIsKeepingPopup(checked);
                        }}
                    />
                    <span>Keep Window Open</span>
                </div>
            ) : null}
            <button
                className={
                    'btn btn-sm btn' +
                    `-${isLookupOnline ? '' : 'outline-'}info`
                }
                title="Lookup bible online"
                onClick={() => {
                    setIsLookupOnline(!isLookupOnline);
                }}
            >
                <i className="bi bi-search" />
            </button>
            {!appProvider.isPageReader ? null : (
                <>
                    <QuickOrBackButtonComp title="Quit Reader" />
                    <SettingButtonComp />
                </>
            )}
        </div>
    );
}
