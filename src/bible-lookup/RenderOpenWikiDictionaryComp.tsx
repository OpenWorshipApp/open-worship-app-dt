import appProvider from '../server/appProvider';
import {
    getLangData,
    getLangCode,
    getLanguageTitle,
    reversedLocalesMap,
    tran,
} from '../lang/langHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';

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
        childBefore: genContextMenuItemIcon('translate'),
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
            childBefore: genContextMenuItemIcon('journal-text'),
            menuElement: tran('Open Wiki Dictionary'),
            disabled: true,
        },
        { menuElement: elementDivider },
        {
            childBefore: genContextMenuItemIcon('translate'),
            menuElement: tran('English'),
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
            title={tran('Wiki Dictionary')}
            aria-label={tran('Wiki Dictionary')}
            onClick={handleWikiDictionaryOpening.bind(null, bibleKey)}
        >
            <i className="bi bi-journal-text" />
        </button>
    );
}
