import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { getLanguageTitle, tran } from '../lang/langHelpers';
import {
    getLookupLangCodeListAsync,
    setSelectedLookupLangCode,
    useSelectedLookupLangCode,
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
 */
export default function LookupLangCodeButtonComp() {
    const langCode = useSelectedLookupLangCode();
    const label = tran('Names and locations language');
    return (
        <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-1 font-monospace"
            title={`${label} (${getLanguageTitle({ langCode })})`}
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
                                setSelectedLookupLangCode(itemLangCode);
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
