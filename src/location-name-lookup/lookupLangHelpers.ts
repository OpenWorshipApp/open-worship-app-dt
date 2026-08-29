import { useSyncExternalStore } from 'react';

import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    DEFAULT_LANG_CODE,
    checkIsValidLangCode,
    getAllLangsAsync,
} from '../lang/langHelpers';

/**
 * Which language the names-and-locations dataset is read in.
 *
 * Deliberately its OWN setting rather than the app locale: the two answer
 * different questions. The locale picks the language of the interface, while
 * this picks the language of the *content* — a Khmer-speaking user reading an
 * English bible may well want the records in Khmer, and an English UI with
 * Khmer records is just as legitimate the other way round.
 *
 * Every lookup surface reads it from here, so a change reaches the floating
 * panel, the detail panels, the note editor's mentions and the
 * "names and locations in your reading" list alike.
 */
const LOOKUP_LANG_SETTING_NAME = 'location-name-lookup-lang-code';

// Memoized because `useSyncExternalStore` calls `getSnapshot` on every render
// and it must not turn into a settings read per render — and because the value
// is compared by identity to decide whether anything changed.
let selectedLangCode: string | null = null;

const listeners = new Set<() => void>();

export function getSelectedLookupLangCode(): string {
    if (selectedLangCode === null) {
        const savedLangCode = getSetting(LOOKUP_LANG_SETTING_NAME) ?? '';
        // A code the running build no longer ships would otherwise fail every
        // load with "no lookup data", leaving the panel permanently broken with
        // no way back from inside it.
        selectedLangCode = checkIsValidLangCode(savedLangCode)
            ? savedLangCode
            : DEFAULT_LANG_CODE;
    }
    return selectedLangCode;
}

export function setSelectedLookupLangCode(langCode: string) {
    if (langCode === getSelectedLookupLangCode()) {
        return;
    }
    selectedLangCode = langCode;
    setSetting(LOOKUP_LANG_SETTING_NAME, langCode);
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Notified AFTER the new code is readable from `getSelectedLookupLangCode`.
 *
 * The data layers hang their invalidation off this: a language change makes
 * every resident lookup structure wrong, and each holder has to drop what it
 * has rather than keep serving the previous language.
 */
export function subscribeLookupLangCode(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useSelectedLookupLangCode() {
    return useSyncExternalStore(
        subscribeLookupLangCode,
        getSelectedLookupLangCode,
        getSelectedLookupLangCode,
    );
}

// The shipped language packages cannot change under a running app, so this is
// resolved at most once — and only when the picker is actually opened, since
// answering it imports every language module.
let langCodeListPromise: Promise<string[]> | null = null;

/**
 * The language codes that ship a lookup dataset, in `supportedLangCodes` order.
 *
 * Only the CODES are kept: the language modules themselves are let go again, so
 * opening the picker does not leave every package resident.
 */
export function getLookupLangCodeListAsync(): Promise<string[]> {
    langCodeListPromise ??= getAllLangsAsync().then((langDataList) => {
        return langDataList
            .filter((langData) => {
                return langData.getLookupData !== undefined;
            })
            .map((langData) => {
                return langData.langCode;
            });
    });
    return langCodeListPromise;
}
