import { allLocalesMap } from '../../lang/langHelpers';

/**
 * The locale a Bible being imported is reviewed with. A bare language code
 * -- `locale="en"`, as the app's own XML format example writes it -- is read
 * as its usual region (`en` -> `en-US`, `Intl.Locale#maximize`) when the
 * locale table has that one. Until 2026-11-21 the review answered _Choose a
 * valid locale_ and kept Import shut, so a Bible written from the app's own
 * example could not be imported as written (F-22 of robot run
 * 20261120-2021). Anything else is handed back as it came, for the person to
 * correct.
 */
export function toImportLocale(locale: string) {
    if (Object.hasOwn(allLocalesMap, locale)) {
        return locale;
    }
    try {
        const expanded = new Intl.Locale(locale.trim()).maximize();
        if (expanded.region !== undefined) {
            const regional = `${expanded.language}-${expanded.region}`;
            if (Object.hasOwn(allLocalesMap, regional)) {
                return regional;
            }
        }
    } catch {
        // Not a language code at all: the person picks one.
    }
    return locale;
}
