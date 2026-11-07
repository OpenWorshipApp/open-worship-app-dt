import { useState, type ReactNode } from 'react';

import { useAppEffect, useAppStateAsync } from '../../helper/appHooks';
import {
    getInstalledLangPlugins,
    getLanguageTitle,
    tran,
    type LocaleType,
} from '../../lang/langHelpers';
import { onLangPluginsChanged } from '../../lang/langPluginRegistry';
import type { LangPluginType } from '../../../electron/langPluginProtocol';
import { forceReloadAppWindows, openLanguagesSetting } from '../settingHelpers';
import {
    findLangCatalogEntry,
    readLangCatalogForBibles,
    toBibleLangPackageState,
    toLangPackageLabel,
} from './bibleLangPackageHelpers';

// A row of Settings > Bible asking for the language its Bible is written in,
// when that language is not installed or is turned off
// (`bibleLangPackageHelpers.ts`). Installing it here is the Languages tab's
// own install, so its progress and toast are the same -- and, as there, the
// change is applied at once: every window reloads (2026-11-05, the user: _any
// modification on language setting ... it should apply the setting (reload
// the app) instancely_).

const LANGUAGE_PLACEHOLDER = '{language}';

function BibleLangSentenceComp({
    text,
    label,
}: Readonly<{ text: string; label: string }>) {
    // The name keeps its own direction inside the sentence, whichever way
    // the window reads.
    const name = <bdi className="fw-bold">{label}</bdi>;
    const index = text.indexOf(LANGUAGE_PLACEHOLDER);
    if (index < 0) {
        return (
            <span>
                {name}: {text}
            </span>
        );
    }
    return (
        <span>
            {text.slice(0, index)}
            {name}
            {text.slice(index + LANGUAGE_PLACEHOLDER.length)}
        </span>
    );
}

function BibleLangPackageNoticeComp({
    text,
    label,
    action,
}: Readonly<{ text: string; label: string; action: ReactNode }>) {
    return (
        <div className="small ms-2 me-1 mt-1 d-flex align-items-center gap-2">
            <i className="bi bi-translate text-warning" />
            <div className="flex-fill">
                <BibleLangSentenceComp text={text} label={label} />
            </div>
            {action}
        </div>
    );
}

function BibleLangTurnedOffComp({
    plugin,
}: Readonly<{ plugin: LangPluginType }>) {
    const label = toLangPackageLabel(plugin.name, plugin.nativeName);
    const handleEnabling = async () => {
        const { setLangPluginEnabled } =
            await import('../../lang/langPluginInstallHelpers');
        setLangPluginEnabled(plugin.langCode, true);
        // Every window shows the language from a reload, as after turning it
        // on in the Languages tab.
        forceReloadAppWindows();
    };
    return (
        <BibleLangPackageNoticeComp
            text={tran(
                'This Bible is in {language}, which is turned off. Turn it on to give the Bible its full language data.',
            )}
            label={label}
            action={
                <button
                    className="btn btn-sm btn-primary py-0 text-nowrap"
                    aria-label={`${tran('Enable')}: ${label}`}
                    onClick={handleEnabling}
                >
                    {tran('Enable')}
                </button>
            }
        />
    );
}

function BibleLangMissingComp({ langCode }: Readonly<{ langCode: string }>) {
    // `undefined` while the catalog is read, `null` when it could not be.
    const [entryList] = useAppStateAsync(readLangCatalogForBibles, []);
    const [isBusy, setIsBusy] = useState(false);
    if (entryList === undefined) {
        return null;
    }
    const entry =
        entryList === null ? null : findLangCatalogEntry(entryList, langCode);
    if (entryList !== null && entry === null) {
        // The catalog has no package of this language: nothing to offer.
        return null;
    }
    const text = tran(
        'This Bible is in {language}. Install that language to give the Bible its full language data.',
    );
    if (entry === null) {
        // Offline: the Languages tab still installs one from a file.
        const label = getLanguageTitle({ langCode });
        return (
            <BibleLangPackageNoticeComp
                text={text}
                label={label}
                action={
                    <button
                        className="btn btn-sm btn-outline-primary py-0 text-nowrap"
                        onClick={() => {
                            openLanguagesSetting();
                        }}
                    >
                        <i className="bi bi-translate me-1" />
                        {tran('Languages')}
                    </button>
                }
            />
        );
    }
    const label = toLangPackageLabel(entry.name, entry.nativeName);
    const handleInstalling = async () => {
        setIsBusy(true);
        try {
            const { installLangPlugin } =
                await import('../../lang/langPluginInstallHelpers');
            if (await installLangPlugin(entry, null)) {
                forceReloadAppWindows();
            }
        } finally {
            setIsBusy(false);
        }
    };
    return (
        <BibleLangPackageNoticeComp
            text={text}
            label={label}
            action={
                <button
                    className="btn btn-sm btn-primary py-0 text-nowrap"
                    disabled={isBusy}
                    aria-label={`${tran('Install')}: ${label}`}
                    onClick={handleInstalling}
                >
                    <i className="bi bi-download me-1" />
                    {tran('Install')}
                </button>
            }
        />
    );
}

export default function BibleXMLLangPackageComp({
    locale,
}: Readonly<{ locale: LocaleType | undefined }>) {
    const [pluginList, setPluginList] = useState(getInstalledLangPlugins);
    useAppEffect(() => {
        // An install, a delete or a switch -- here or in another window --
        // has re-read the list.
        return onLangPluginsChanged(() => {
            setPluginList(getInstalledLangPlugins());
        });
    }, []);
    const state = toBibleLangPackageState(locale, pluginList);
    if (state.kind === 'turned-off') {
        return <BibleLangTurnedOffComp plugin={state.plugin} />;
    }
    if (state.kind === 'missing') {
        return <BibleLangMissingComp langCode={state.langCode} />;
    }
    return null;
}
