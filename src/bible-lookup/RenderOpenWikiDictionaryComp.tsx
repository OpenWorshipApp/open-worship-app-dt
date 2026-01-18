import appProvider from '../server/appProvider';
import {
    getLangData,
    getLangCode,
    getLanguageTitle,
    reversedLocalesMap,
} from '../lang/langHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';

function genContextMenuItem(langCode: string): ContextMenuItemType {
    const url = `https://${langCode}.wiktionary.org`;
    let menuElement = getLanguageTitle({ langCode });
    if (menuElement === 'Unknown') {
        menuElement = `${langCode} (Unknown)`;
    } else {
        menuElement += ` [${langCode}]`;
    }
    const langData = getLangData(langCode);
    const fontFamily = langData === null ? undefined : langData.fontFamily;
    return {
        menuElement,
        title: url,
        onSelect: () => {
            appProvider.browserUtils.openExternalURL(url);
        },
        style: {
            fontFamily,
        },
    };
}

async function handleWikiDictionaryOpening(bibleKey: string, event: any) {
    const targetLocale = await getBibleLocale(bibleKey);
    let targetLangCode = getLangCode(targetLocale);
    if (targetLangCode === 'en') {
        targetLangCode = null;
    }
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

export default function RenderOpenWikiDictionaryComp() {
    const bibleKey = useBibleKeyContext();
    return (
        <button
            className="btn btn-sm btn-secondary"
            title="Wiki Dictionary"
            onClick={handleWikiDictionaryOpening.bind(null, bibleKey)}
        >
            <i className="bi bi-journal-text" />
        </button>
    );
}
