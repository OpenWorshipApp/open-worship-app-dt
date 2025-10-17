import InputHandlerComp from './InputHandlerComp';
import RenderExtraButtonsRightComp from './RenderExtraButtonsRightComp';
import BibleLookupInputHistoryComp from './BibleLookupInputHistoryComp';
import appProvider from '../server/appProvider';
import { ModalCloseButton } from '../app-modal/ModalComp';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { AIConfigComp } from '../bible-reader/AIConfigComp';
import {
    getLangCode,
    languageNameMap,
    reversedLocalesMap,
} from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { getBibleLocale } from '../helper/bible-helpers/serverBibleHelpers2';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';

function genContextMenuItem(langCode: string) {
    const url = `https://${langCode}.wiktionary.org`;
    const menuElement = languageNameMap[langCode] ?? `Unknown (${langCode})`;
    return {
        menuElement,
        title: url,
        onSelect: () => {
            appProvider.browserUtils.openExternalURL(url);
        },
    };
}

async function handleWikiDictionaryOpening(bibleKey: string, event: any) {
    const targetLang = await getBibleLocale(bibleKey);
    const targetLangCode = getLangCode(targetLang);
    const excludeLangCodes = ['en'];
    if (targetLangCode !== null && !excludeLangCodes.includes(targetLangCode)) {
        excludeLangCodes.push(targetLangCode);
    }
    const langCodes = Object.keys(reversedLocalesMap).filter((langCode) => {
        return !excludeLangCodes.includes(langCode);
    });
    showAppContextMenu(event, [
        {
            menuElement: 'Open Wiki Dictionary',
            disabled: true,
        },
        { menuElement: elementDivider },
        {
            menuElement: 'English',
            onSelect: () => {
                const url = `https://en.wiktionary.org`;
                appProvider.browserUtils.openExternalURL(url);
            },
        },
        ...(targetLangCode === null
            ? []
            : [genContextMenuItem(targetLangCode)]),
        { menuElement: elementDivider },
        ...langCodes.map(genContextMenuItem),
    ]);
}

export default function RenderBibleLookupHeaderComp({
    isLookupOnline,
    setIsLookupOnline,
}: Readonly<{
    isLookupOnline: boolean;
    setIsLookupOnline: (isLookupOnline: boolean) => void;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
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
                <button
                    className="btn btn-sm btn-secondary"
                    title="Wiki Dictionary"
                    onClick={handleWikiDictionaryOpening.bind(null, bibleKey)}
                >
                    <i className="bi bi-journal-text" />
                </button>
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
