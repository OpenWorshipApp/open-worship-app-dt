import { useCallback, useState } from 'react';

import { getCurrentLocale, getLangCode, tran } from '../lang/langHelpers';
import {
    loadLlmRegistry,
    useLlmRegistry,
} from '../helper/ai/customServerHelpers';
import {
    getUsableCustomModels,
    pickRegistryNote,
    type CustomServerType,
    type LlmRegistryStatusType,
} from '../../electron/customLlmProtocol';
import SettingOthersFoldButtonComp from './SettingOthersFoldButtonComp';
import SettingOthersGroupComp from './SettingOthersGroupComp';

/**
 * The servers the project's own site shares with every copy of the app
 * (`electron/llmRegistryHelpers.ts`, `docs/llm-registry/README.md`), listed
 * under the user's own -- and read-only: they are an admin's to change, in
 * one file on the site, not this computer's. Asked for on 2026-10-10 with a
 * picture of the chatbot's list beside this tab: _in setting should have
 * those llm endpoints (read-only) and have refresh icon as well_.
 *
 * No key and no address is shown because neither is here: both stay in the
 * main process, and what this window holds for an address is a stand-in
 * (`toPublicRegistryServers`). The address was listed until 2026-10-12, when
 * the user circled it: _hide endpoint and api key, to avoid easily copy and
 * use_ -- a shared server is for this app to ask, not an address to take
 * away. Names, model ids and notes are the admin's own words and NEVER go
 * through `tran()`: it throws on a key it does not know. A note is shown in
 * this window's language when the file has one in it (`pickRegistryNote`).
 */

function RenderSharedMarkComp() {
    return (
        <i
            className="bi bi-check-circle-fill app-setting-others-field-set"
            title={tran('Offered in the chatbot')}
        />
    );
}

function RenderSharedServerComp({
    server,
}: Readonly<{ server: CustomServerType }>) {
    // Folded to its name and how many models it offers, like one of the
    // user's own -- but not remembered: the list is the site's and its ids
    // come and go, so a fold kept for each would only pile up.
    const [isCollapsed, setIsCollapsed] = useState(true);
    const handleToggling = useCallback(() => {
        setIsCollapsed((isOld) => {
            return !isOld;
        });
    }, []);
    const models = getUsableCustomModels(server);
    const langCode = getLangCode(getCurrentLocale()) ?? '';
    const serverNote = pickRegistryNote(server.note, langCode);
    return (
        <div
            className={
                'app-setting-others-server' +
                (isCollapsed ? ' app-setting-others-collapsed' : '')
            }
        >
            <div
                className={
                    'd-flex align-items-center gap-2' +
                    (isCollapsed ? '' : ' mb-2')
                }
            >
                <span className="app-setting-others-group-title m-0 flex-fill">
                    <SettingOthersFoldButtonComp
                        isCollapsed={isCollapsed}
                        onToggle={handleToggling}
                    >
                        {server.name}
                        {' · '}
                        {tran('Models')}: {models.length}
                    </SettingOthersFoldButtonComp>
                    {isCollapsed ? <RenderSharedMarkComp /> : null}
                </span>
                <i
                    className="bi bi-lock app-data"
                    title={tran(
                        'Shared by openworship.app. It cannot be changed here.',
                    )}
                />
            </div>
            {isCollapsed ? null : (
                <>
                    {serverNote.length > 0 ? (
                        <div className="small mb-2">
                            <i className="bi bi-info-circle me-1" />
                            {serverNote}
                        </div>
                    ) : null}
                    <div className="app-setting-others-label">
                        {tran('Models')}
                    </div>
                    <div className="app-setting-others-models">
                        {models.map((row) => {
                            return (
                                <div key={row.id} className="app-data small">
                                    <span className="user-select-all">
                                        {row.model}
                                    </span>
                                    {row.name.length > 0
                                        ? ` · ${row.name}`
                                        : ''}
                                    {row.canSeeImages === true ? (
                                        <>
                                            {' · '}
                                            <i className="bi bi-image me-1" />
                                            {tran('Sees pictures')}
                                        </>
                                    ) : null}
                                    {row.note === undefined ? null : (
                                        <div>
                                            <i className="bi bi-info-circle me-1" />
                                            {pickRegistryNote(
                                                row.note,
                                                langCode,
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * How the last read of the site's file went. A read that fails keeps the
 * servers of the one before, so the list alone would not show it.
 */
function RenderRegistryStatusComp({
    status,
}: Readonly<{ status: LlmRegistryStatusType | null }>) {
    if (status === null) {
        return null;
    }
    if (status.error !== null) {
        return (
            <div className="small text-warning mb-2">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {tran('The last read failed:')} {status.error}
            </div>
        );
    }
    return (
        <div className="app-data small mb-2">
            {status.servers.length === 0
                ? `${tran('No server is shared right now.')} `
                : ''}
            {status.fetchedAt === null
                ? ''
                : `${tran('Last read at')} ${new Date(status.fetchedAt).toLocaleTimeString()}`}
        </div>
    );
}

export default function SettingOthersSharedServersComp() {
    const { servers, status } = useLlmRegistry();
    const [isReloading, setIsReloading] = useState(false);
    // Reads the file on the site again: an admin changed it, and this window
    // should not need a restart to see that.
    const handleReloading = useCallback(async () => {
        setIsReloading(true);
        try {
            await loadLlmRegistry(true);
        } finally {
            setIsReloading(false);
        }
    }, []);
    return (
        <SettingOthersGroupComp
            foldName="ai-shared-servers"
            title={tran('Shared servers')}
            isWide
            foldedMark={servers.length > 0 ? <RenderSharedMarkComp /> : null}
        >
            <div className="d-flex align-items-start gap-2 mb-2">
                <div className="app-data small flex-fill">
                    {tran(
                        'Servers that openworship.app shares with every copy of the app. They are read-only here, and each one shows in the chatbot as its own assistant.',
                    )}
                </div>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    title={tran('Reload the shared servers')}
                    aria-label={tran('Reload the shared servers')}
                    disabled={isReloading}
                    onClick={handleReloading}
                >
                    <i
                        className={
                            isReloading
                                ? 'spinner-border spinner-border-sm'
                                : 'bi bi-arrow-clockwise'
                        }
                    />
                </button>
            </div>
            <RenderRegistryStatusComp status={status} />
            <div className="app-setting-others-group-fields">
                {servers.map((server) => {
                    return (
                        <RenderSharedServerComp
                            key={server.id}
                            server={server}
                        />
                    );
                })}
            </div>
        </SettingOthersGroupComp>
    );
}
