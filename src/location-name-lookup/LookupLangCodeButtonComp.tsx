import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    type LocaleType,
    getLangCode,
    getLanguageTitle,
    tran,
} from '../lang/langHelpers';
import {
    getLookupLangCodeListAsync,
    setSelectedLookupLangCode,
    useLookupLangCode,
} from './lookupLangHelpers';

/**
 * Which language the names and locations are read in, and the way to change it.
 *
 * The code itself is the label — `en`, `km` — because it sits in a toolbar of
 * icon buttons where a full language name has no room, and because the code is
 * what the user picked from the menu.
 *
 * The list of choices is resolved ON CLICK, never on mount: answering it imports
 * every shipped language module, and this button is in the bible lookup header,
 * which mounts far more often than anyone opens this menu.
 *
 * Given the locale of the bible being read, the code is green while it names
 * that bible's language and red while it does not — a Khmer bible beside `en`
 * records is easy to miss. Without a bible it stays grey.
 */
function toColorClass(bibleLangCode: string | null, langCode: string) {
    if (bibleLangCode === null) {
        return 'btn-outline-secondary';
    }
    return bibleLangCode === langCode
        ? 'btn-outline-success'
        : 'btn-outline-danger';
}

export default function LookupLangCodeButtonComp({
    onSelect = setSelectedLookupLangCode,
    isDetailHeader = false,
    bibleLocale,
}: Readonly<{
    onSelect?: (langCode: string) => void;
    isDetailHeader?: boolean;
    bibleLocale?: LocaleType;
}>) {
    const langCode = useLookupLangCode();
    const label = tran('Names and locations language');
    const bibleLangCode = bibleLocale ? getLangCode(bibleLocale) : null;
    let title = `${label} (${getLanguageTitle({ langCode })})`;
    if (bibleLangCode !== null && bibleLangCode !== langCode) {
        title +=
            `\n${tran('Not the language of the Bible')}` +
            ` (${getLanguageTitle({ langCode: bibleLangCode })})`;
    }
    return (
        <button
            type="button"
            className={
                isDetailHeader
                    ? 'floating-widget__button font-monospace'
                    : 'btn btn-sm px-1 font-monospace ' +
                      toColorClass(bibleLangCode, langCode)
            }
            title={title}
            aria-label={label}
            onClick={async (event) => {
                const nativeEvent = event.nativeEvent;
                const langCodeList = await getLookupLangCodeListAsync();
                showAppContextMenu(
                    nativeEvent,
                    langCodeList.map((itemLangCode) => {
                        return {
                            id: itemLangCode,
                            // Not `tran(...)`: the picker has to stay legible to
                            // someone who cannot read the locale currently in
                            // force. `getLanguageTitle` carries the language's
                            // own name beside the English one — see
                            // `LanguageDataType.nativeName`.
                            menuElement: `${itemLangCode} - ${getLanguageTitle({
                                langCode: itemLangCode,
                            })}`,
                            childBefore:
                                itemLangCode === langCode ? (
                                    <i className="bi bi-check-lg me-1" />
                                ) : undefined,
                            onSelect: () => {
                                onSelect(itemLangCode);
                            },
                        };
                    }),
                );
            }}
        >
            {langCode}
        </button>
    );
}
