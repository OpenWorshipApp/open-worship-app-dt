import type { ChangeEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { reportPackageUpdates } from '../helper/packageUpdateHelpers';
import { ensureLangPlugins, tran } from '../lang/langHelpers';
import englishMetaFile from '../lang/data/en/meta.json';
import { onLangPluginsChanged } from '../lang/langPluginRegistry';
import type { LangCatalogEntryType } from '../lang/langPluginInstallHelpers';
import {
    checkIsLangUpdateAvailable,
    deleteLangPlugin,
    getLangCatalogEntries,
    importLangPluginFromFile,
    installLangPlugin,
    isolateText,
    listLangUpdateCodes,
    saveLangPackToDownloads,
    searchLangCatalog,
    setLangPluginEnabled,
} from '../lang/langPluginInstallHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import type { LangPluginType } from '../../electron/langPluginProtocol';
import { applyStore } from './SettingApplyComp';
import { forceReloadAppWindows } from './settingHelpers';
import SettingOthersSectionComp from './SettingOthersSectionComp';
import SettingLanguagePickerComp from './SettingLanguagePickerComp';

// Settings > Languages (2026-11-04, the user: _add new tab `Languages` to list
// language plugin (include English), it should enable/disable (except English)
// the language data_, and _as a user I want to be able to search and install
// my language_). English is the app's own and always on; every other language
// is a plugin -- shipped with the app (`electron-build/lang`, read-only: it
// can be turned off, never deleted) or installed from the catalog into the
// data folder (`<data folder>/lang`: updated and deleted here too).
//
// Every change here is applied AT ONCE (2026-11-05, the user: _when there are
// any modification on language setting like installed removed updated
// selected new language it should apply the setting (reload the app)
// instancely_): a language turned on or off, installed, updated, imported or
// deleted reloads every window, as Apply Settings does, instead of lighting
// that button and waiting for it. A change that did not happen (a failed
// install, an import refused) reloads nothing.

type EnglishMetaType = {
    name?: string;
    nativeName?: string;
    version?: string;
    description?: string;
};
const ENGLISH_META = englishMetaFile as EnglishMetaType;

type ActionsType = {
    isBusy: boolean;
    onToggling: (plugin: LangPluginType, isEnabled: boolean) => void;
    onInstalling: (
        entry: LangCatalogEntryType,
        plugin: LangPluginType | null,
    ) => void;
    onDeleting: (plugin: LangPluginType) => void;
    onSaving: (entry: LangCatalogEntryType) => void;
};

function RenderBadgeComp({
    label,
    className,
}: Readonly<{ label: string; className: string }>) {
    return <span className={`badge ms-1 ${className}`}>{tran(label)}</span>;
}

function RenderLanguageNameComp({
    nativeName,
    name,
}: Readonly<{ nativeName: string; name: string }>) {
    // Its own name first, as the language picker shows it: a person who
    // cannot read the language the app is in must still find their own.
    return (
        <strong title={name}>
            <bdi>{nativeName}</bdi>
            {nativeName === name ? null : (
                // A space, not a margin: it stands on the right side in a
                // right-to-left window too.
                <span className="text-body-secondary">
                    {' '}
                    (<bdi>{name}</bdi>)
                </span>
            )}
        </strong>
    );
}

function RenderEnglishRowComp() {
    return (
        <li className="list-group-item d-flex align-items-center gap-2">
            <div className="form-check form-switch m-0">
                <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked
                    disabled
                    aria-label={tran('English is always on')}
                    title={tran('English is always on')}
                />
            </div>
            <div className="flex-grow-1 app-overflow-hidden">
                <RenderLanguageNameComp
                    nativeName={ENGLISH_META.nativeName ?? 'English'}
                    name={ENGLISH_META.name ?? 'English'}
                />
                <RenderBadgeComp
                    label="Built in"
                    className="text-bg-secondary"
                />
                <div className="small text-body-secondary">
                    {`${tran('Version')} ${ENGLISH_META.version ?? ''}`}
                </div>
            </div>
        </li>
    );
}

function RenderInstalledRowComp({
    plugin,
    catalogEntry,
    actions,
}: Readonly<{
    plugin: LangPluginType;
    catalogEntry: LangCatalogEntryType | undefined;
    actions: ActionsType;
}>) {
    const switchId = `app-lang-plugin-enabled-${plugin.langCode}`;
    const isUpdatable = checkIsLangUpdateAvailable(plugin, catalogEntry);
    const handleToggling = (event: ChangeEvent<HTMLInputElement>) => {
        actions.onToggling(plugin, event.currentTarget.checked);
    };
    return (
        <li className="list-group-item d-flex align-items-center gap-2">
            <div className="form-check form-switch m-0">
                <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id={switchId}
                    checked={plugin.isEnabled}
                    disabled={actions.isBusy}
                    onChange={handleToggling}
                    aria-label={`${tran('Enabled')}: ${plugin.name}`}
                />
            </div>
            <label
                className="flex-grow-1 app-overflow-hidden"
                htmlFor={switchId}
            >
                <RenderLanguageNameComp
                    nativeName={plugin.nativeName}
                    name={plugin.name}
                />
                {isUpdatable ? (
                    // The end of the trail from the Setting gear's dot.
                    <span
                        className="app-update-dot-inline"
                        role="img"
                        title={tran('Update Available')}
                        aria-label={tran('Update Available')}
                    />
                ) : null}
                {plugin.isBuiltIn ? (
                    <RenderBadgeComp
                        label="Built in"
                        className="text-bg-secondary"
                    />
                ) : (
                    <RenderBadgeComp
                        label="Installed"
                        className="text-bg-info"
                    />
                )}
                {plugin.isEnabled ? null : (
                    <RenderBadgeComp
                        label="Turned off"
                        className="text-bg-warning"
                    />
                )}
                <div className="small text-body-secondary">
                    {`${tran('Version')} ${plugin.version}`}
                    {plugin.description ? (
                        // In the language it was written in, whichever way
                        // the window reads.
                        <>
                            {' · '}
                            <bdi>{plugin.description}</bdi>
                        </>
                    ) : null}
                </div>
            </label>
            {isUpdatable && catalogEntry !== undefined ? (
                <button
                    className="btn btn-sm btn-warning"
                    disabled={actions.isBusy}
                    onClick={() => {
                        actions.onInstalling(catalogEntry, plugin);
                    }}
                >
                    {`${tran('Update to')} ${catalogEntry.version}`}
                </button>
            ) : null}
            {/* The folder of the copy in use, shown in the file manager: the
                files to look at, or to pass on by hand. Only reads, so it
                waits for nothing. */}
            <button
                className="btn btn-sm btn-outline-secondary"
                title={`${plugin.dirPath}\n${tran('Reveal Folder')}`}
                aria-label={`${tran('Reveal Folder')}: ${plugin.name}`}
                onClick={() => {
                    showFileOrDirExplorer(plugin.dirPath);
                }}
            >
                <i className="bi bi-folder2-open" />
            </button>
            {plugin.removableDirPaths.length > 0 ? (
                <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={actions.isBusy}
                    title={tran('Delete')}
                    aria-label={`${tran('Delete')}: ${plugin.name}`}
                    onClick={() => {
                        actions.onDeleting(plugin);
                    }}
                >
                    <i className="bi bi-trash" />
                </button>
            ) : null}
        </li>
    );
}

function RenderCatalogRowComp({
    entry,
    plugin,
    actions,
}: Readonly<{
    entry: LangCatalogEntryType;
    plugin: LangPluginType | null;
    actions: ActionsType;
}>) {
    const isUpdatable =
        plugin !== null && checkIsLangUpdateAvailable(plugin, entry);
    let action;
    if (plugin === null) {
        action = (
            <button
                className="btn btn-sm btn-primary"
                disabled={actions.isBusy}
                onClick={() => {
                    actions.onInstalling(entry, null);
                }}
            >
                {tran('Install')}
            </button>
        );
    } else if (isUpdatable) {
        action = (
            <button
                className="btn btn-sm btn-warning"
                disabled={actions.isBusy}
                onClick={() => {
                    actions.onInstalling(entry, plugin);
                }}
            >
                {`${tran('Update to')} ${entry.version}`}
            </button>
        );
    } else {
        action = (
            <span className="text-success small">
                <i className="bi bi-check-circle me-1" />
                {tran('Installed')}
            </span>
        );
    }
    return (
        <li className="list-group-item d-flex align-items-center gap-2">
            <div className="flex-grow-1 app-overflow-hidden">
                <RenderLanguageNameComp
                    nativeName={entry.nativeName}
                    name={entry.name}
                />
                <div className="small text-body-secondary">
                    {`${tran('Version')} ${entry.version}`}
                    {entry.description ? (
                        <>
                            {' · '}
                            <bdi>{entry.description}</bdi>
                        </>
                    ) : null}
                </div>
            </div>
            {/* The pack saved into Downloads, not installed: the file to
                pass on to a friend whose computer has no internet. */}
            <button
                className="btn btn-sm btn-outline-secondary"
                disabled={actions.isBusy}
                title={tran('Download')}
                aria-label={`${tran('Download')}: ${entry.name}`}
                onClick={() => {
                    actions.onSaving(entry);
                }}
            >
                <i className="bi bi-download" />
            </button>
            {action}
        </li>
    );
}

export default function SettingLanguagesComp() {
    const [pluginRefreshCount, setPluginRefreshCount] = useState(0);
    const [catalogRefreshCount, setCatalogRefreshCount] = useState(0);
    const [isBusy, setIsBusy] = useState(false);
    const [query, setQuery] = useState('');
    const [pluginList] = useAppStateAsync<LangPluginType[]>(() => {
        return ensureLangPlugins();
    }, [pluginRefreshCount]);
    // `undefined` while the catalog is read, `null` when it could not be (no
    // internet is not an error here: what is installed still shows).
    const [catalogEntryList] = useAppStateAsync<LangCatalogEntryType[] | null>(
        getLangCatalogEntries,
        [catalogRefreshCount],
    );
    useAppEffect(() => {
        // A change made here, or in another window, has re-read the list.
        return onLangPluginsChanged(() => {
            setPluginRefreshCount((count) => {
                return count + 1;
            });
        });
    }, []);
    const catalogEntryMap = useMemo(() => {
        return new Map(
            (catalogEntryList ?? []).map((entry) => {
                return [entry.langCode, entry];
            }),
        );
    }, [catalogEntryList]);
    // What this tab learns goes to the Setting gear's dot and this tab's
    // (`packageUpdateHelpers.ts`): an update installed here clears them, and
    // one found by Refresh lights them. Only once both lists are read -- an
    // unread or unreachable catalog says nothing about updates.
    const updateCodes = useMemo(() => {
        return pluginList && catalogEntryList
            ? listLangUpdateCodes(pluginList, catalogEntryList)
            : null;
    }, [pluginList, catalogEntryList]);
    useAppEffect(() => {
        if (updateCodes !== null) {
            reportPackageUpdates({ langCodes: updateCodes });
        }
    }, [updateCodes]);
    const pluginListRef = useAppCurrentRef(pluginList);

    const handleToggling = useCallback(
        (plugin: LangPluginType, isEnabled: boolean) => {
            setLangPluginEnabled(plugin.langCode, isEnabled);
            // Every window shows its languages again from a reload, as after
            // picking a language. The switch's setting is written before the
            // reload is asked for: both go to main down the same channel, in
            // order.
            forceReloadAppWindows();
        },
        [],
    );
    const handleInstalling = useCallback(
        async (entry: LangCatalogEntryType, plugin: LangPluginType | null) => {
            setIsBusy(true);
            try {
                const isInstalled = await installLangPlugin(entry, plugin);
                if (isInstalled) {
                    forceReloadAppWindows();
                }
            } finally {
                setIsBusy(false);
            }
        },
        [],
    );
    const handleDeleting = useCallback(async (plugin: LangPluginType) => {
        const isOk = await showAppConfirm(
            tran('Delete Language'),
            plugin.builtInVersion === null
                ? `${tran('Delete this language from this computer?')} ` +
                      isolateText(plugin.nativeName)
                : `${tran(
                      'Delete the installed update? The version that came with the app stays.',
                  )} ${isolateText(plugin.nativeName)}`,
            { cancelButtonLabel: 'Cancel', confirmButtonLabel: 'Delete' },
        );
        if (!isOk) {
            return;
        }
        setIsBusy(true);
        try {
            if (await deleteLangPlugin(plugin)) {
                forceReloadAppWindows();
            } else {
                // Some of its files are in use: the toast says to close the
                // app and press Delete again, and a reload now would take
                // that toast away before it is read. Apply Settings is lit
                // for what did change.
                applyStore.pendingApply();
            }
        } finally {
            setIsBusy(false);
        }
    }, []);
    const handleRefreshing = useCallback(() => {
        setCatalogRefreshCount((count) => {
            return count + 1;
        });
        setPluginRefreshCount((count) => {
            return count + 1;
        });
    }, []);
    // Sharing a language as a file (2026-11-04, the user: _store the
    // extra-bin and language downloaded file somewhere so I can share to my
    // friend easily_): a catalog row's Download saves the pack, Import
    // installs one picked from the disk, with no internet.
    const handleSaving = useCallback(async (entry: LangCatalogEntryType) => {
        setIsBusy(true);
        try {
            await saveLangPackToDownloads(entry);
        } finally {
            setIsBusy(false);
        }
    }, []);
    const handleImporting = useCallback(async () => {
        setIsBusy(true);
        try {
            const isInstalled = await importLangPluginFromFile(
                pluginListRef.current ?? [],
            );
            if (isInstalled) {
                forceReloadAppWindows();
            }
        } finally {
            setIsBusy(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const actions: ActionsType = {
        isBusy,
        onToggling: handleToggling,
        onInstalling: handleInstalling,
        onDeleting: handleDeleting,
        onSaving: handleSaving,
    };

    const shownEntryList =
        catalogEntryList === undefined || catalogEntryList === null
            ? []
            : searchLangCatalog(catalogEntryList, query);
    let catalogBody;
    if (catalogEntryList === undefined) {
        catalogBody = (
            <div className="text-body-secondary">{tran('Checking...')}</div>
        );
    } else if (catalogEntryList === null) {
        catalogBody = (
            <div className="text-body-secondary">
                {tran(
                    'Could not reach the language list. Check the internet and press Refresh.',
                )}
            </div>
        );
    } else if (shownEntryList.length === 0) {
        catalogBody = (
            <div className="text-body-secondary">
                {tran('No language matches.')}
            </div>
        );
    } else {
        catalogBody = (
            <ul className="list-group">
                {shownEntryList.map((entry) => {
                    const plugin =
                        pluginListRef.current?.find((item) => {
                            return item.langCode === entry.langCode;
                        }) ?? null;
                    return (
                        <RenderCatalogRowComp
                            key={entry.langCode}
                            entry={entry}
                            plugin={plugin}
                            actions={actions}
                        />
                    );
                })}
            </ul>
        );
    }
    const updateCount = updateCodes?.length ?? 0;

    return (
        <div className="w-100 h-100 app-setting-others">
            <div className="app-setting-others-rack">
                <SettingLanguagePickerComp />
                <SettingOthersSectionComp
                    foldName="languages-installed"
                    iconClassName="bi-translate"
                    title="Installed Languages"
                    description="English is part of the app. Turn a language off to hide it everywhere; delete one you installed to free its space."
                    state={updateCount > 0 ? 'attention' : 'ready'}
                    isUpdateAvailable={updateCount > 0}
                    stateLabel={
                        updateCount > 0 ? 'Update Available' : 'Installed'
                    }
                    headerActions={
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={isBusy}
                            onClick={handleImporting}
                        >
                            <i className="bi bi-box-arrow-in-down me-1" />
                            {tran('Import')}
                        </button>
                    }
                >
                    <ul className="list-group">
                        <RenderEnglishRowComp />
                        {(pluginList ?? []).map((plugin) => {
                            return (
                                <RenderInstalledRowComp
                                    key={plugin.langCode}
                                    plugin={plugin}
                                    catalogEntry={catalogEntryMap.get(
                                        plugin.langCode,
                                    )}
                                    actions={actions}
                                />
                            );
                        })}
                    </ul>
                </SettingOthersSectionComp>
                <SettingOthersSectionComp
                    foldName="languages-find"
                    iconClassName="bi-search"
                    title="Find a Language"
                    description="Search for your language by its name, in English or in its own words, then install it."
                    state="idle"
                    stateLabel="Online"
                    headerActions={
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={isBusy}
                            title={tran('Refresh')}
                            aria-label={tran('Refresh')}
                            onClick={handleRefreshing}
                        >
                            <i className="bi bi-arrow-clockwise" />
                        </button>
                    }
                >
                    <input
                        type="search"
                        className="form-control form-control-sm mb-2"
                        placeholder={tran('Search languages')}
                        aria-label={tran('Search languages')}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.currentTarget.value);
                        }}
                    />
                    {catalogBody}
                </SettingOthersSectionComp>
            </div>
        </div>
    );
}
