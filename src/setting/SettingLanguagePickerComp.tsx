import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import type { LanguageDataType, LocaleType } from '../lang/langHelpers';
import {
    getAllLangsAsync,
    getCurrentLocale,
    getLangDataAsync,
    setCurrentLocale,
    tran,
} from '../lang/langHelpers';
import { onLangPluginsChanged } from '../lang/langPluginRegistry';
import { forceReloadAppWindows } from './settingHelpers';
import LoadingComp from '../others/LoadingComp';
import SettingOthersSectionComp from './SettingOthersSectionComp';

function RenderLanguageButtonComp({
    currentLocale,
    langData,
    setLocale,
}: Readonly<{
    currentLocale: string;
    langData: LanguageDataType;
    setLocale: (newLocale: LocaleType) => void;
}>) {
    const { locale } = langData;
    const btnType = locale === currentLocale ? 'btn-info' : 'btn-outline-info';
    return (
        <button
            key={locale}
            onClick={async () => {
                if (locale === currentLocale) {
                    // Already in force: nothing to apply, no reload.
                    return;
                }
                // Loaded BEFORE it is stored: `tran` throws in dev on a
                // language this window has not loaded, and the window can
                // render while the plugin loads.
                await getLangDataAsync(locale);
                setCurrentLocale(locale);
                setLocale(locale);
                // Applied at once (2026-11-05, the user: _selected new
                // language it should apply the setting (reload the app)
                // instancely_): every window reloads in it. The choice is
                // written before the reload is asked for -- both go to main
                // down the same channel, in order.
                forceReloadAppWindows();
            }}
            className={`item btn ${btnType}`}
            // The chosen language, in words a screen reader (and the app's
            // tools) can read; the solid button style was its only sign.
            aria-pressed={locale === currentLocale}
            title={langData.name}
        >
            {/*
             * Deliberately NOT `tran(...)`: translating each language's name
             * into the locale currently in force renders the whole list in one
             * script, so a user who cannot read that script has no legible way
             * back out of it. `title` still carries the English name for
             * anyone hovering. See `LanguageDataType.nativeName`.
             */}
            {langData.nativeName ?? langData.name}
            <div
                className="icon pe-1"
                dangerouslySetInnerHTML={{
                    __html: langData.flagSVG,
                }}
            />
        </button>
    );
}

// The language the app is shown in, at the top of Settings > Languages
// (2026-11-04, the user: _move the setting to languages_): choosing one sits
// beside turning one on and installing one, so General no longer carries it.
export default function SettingLanguagePickerComp() {
    const [refreshCount, setRefreshCount] = useState(0);
    const [allLangs] = useAppStateAsync(() => {
        return getAllLangsAsync();
    }, [refreshCount]);
    const [locale, setLocale] = useState(getCurrentLocale());
    // Below it on the same tab a language is installed, updated, deleted or
    // turned on or off, and every window re-reads the list (the user's
    // picture: Khmer installed, and only English and Hebrew offered). Read
    // again then -- and the current language too: turning off or deleting
    // the one in force falls back to English.
    useAppEffect(() => {
        return onLangPluginsChanged(() => {
            setLocale(getCurrentLocale());
            setRefreshCount((count) => {
                return count + 1;
            });
        });
    }, []);
    let element: ReactNode;
    if (allLangs === undefined) {
        element = <LoadingComp />;
    } else if (allLangs === null || allLangs.length === 0) {
        element = <div>{tran('No languages available.')}</div>;
    } else {
        element = (
            <div className="options d-flex flex-wrap">
                {allLangs.map((langData) => {
                    return (
                        <RenderLanguageButtonComp
                            key={langData.locale}
                            currentLocale={locale}
                            langData={langData}
                            setLocale={setLocale}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <SettingOthersSectionComp
            foldName="languages-app"
            iconClassName="bi-translate"
            title="Language"
            state="ready"
        >
            {/* Only the languages turned on are offered; the sections below
                turn them on and off and install more. */}
            <div className="lang mt-2">{element}</div>
        </SettingOthersSectionComp>
    );
}
