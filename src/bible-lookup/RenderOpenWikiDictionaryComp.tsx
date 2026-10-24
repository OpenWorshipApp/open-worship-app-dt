import appProvider from '../server/appProvider';
import {
    getLangData,
    getLangCode,
    getLanguageTitle,
    reversedLocalesMap,
    tran,
    DEFAULT_LANG_CODE,
} from '../lang/langHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';

/**
 * The codes ISO 639 retired in 1989 for Indonesian and Hebrew. The locale map
 * keeps `in-ID` and `iw-IL` beside `id-ID` and `he-IL` for locales written
 * the old way, so each language was listed twice here; Wiktionary's editions
 * are under the current codes.
 */
const RETIRED_LANG_CODE_MAP: { [key: string]: string } = { in: 'id', iw: 'he' };

function toWiktionaryLangCode(langCode: string) {
    return RETIRED_LANG_CODE_MAP[langCode] ?? langCode;
}

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
    const foundLangCode = getLangCode(targetLocale);
    let targetLangCode =
        foundLangCode === null ? null : toWiktionaryLangCode(foundLangCode);
    if (targetLangCode === DEFAULT_LANG_CODE) {
        targetLangCode = null;
    }
    const excludeLangCodes = [DEFAULT_LANG_CODE];
    if (targetLangCode !== null && !excludeLangCodes.includes(targetLangCode)) {
        excludeLangCodes.push(targetLangCode);
    }
    const langCodes = [
        ...new Set(Object.keys(reversedLocalesMap).map(toWiktionaryLangCode)),
    ].filter((langCode) => {
        return !excludeLangCodes.includes(langCode);
    });
    showAppContextMenu(event, [
        {
            childBefore: genContextMenuItemIcon('journal-text'),
            menuElement: tran('Open Wiki Dictionary'),
            isSectionHeader: true,
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
