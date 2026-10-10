import type { ChangeEvent, FocusEvent } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import {
    genCustomModelRow,
    genCustomServer,
    getCustomServerKey,
    getCustomServers,
    listCustomServerModels,
    mergeCustomServerModels,
    readLmStudioModels,
    setCustomServerKey,
    setCustomServers,
    useCustomServers,
    type LmStudioModelInfoMapType,
} from '../helper/ai/customServerHelpers';
import {
    CUSTOM_CONTEXT_COMFORTABLE,
    CUSTOM_CONTEXT_MIN,
    MAX_CUSTOM_MODELS,
    MAX_CUSTOM_SERVERS,
    checkIsUsableCustomServer,
    getUsableCustomModels,
    toContextLabel,
    toCustomServerBaseUrl,
    type CustomModelType,
    type CustomServerType,
    type LmStudioModelInfoType,
} from '../../electron/customLlmProtocol';
import SettingOthersFieldComp from './SettingOthersFieldComp';

/**
 * The user's own model servers -- LM Studio, Ollama, a GPU box down the hall,
 * a hosted service -- anything that speaks OpenAI's protocol. Each one is its
 * own assistant in the chatbot, under the name given here, offering the
 * models listed here.
 *
 * Everything is written on blur, like every other field on this tab. Names
 * and model ids are the user's own words and NEVER go through `tran()`: it
 * throws on a key it does not know.
 */

// Always the stored list, never a closure's copy: two fields left in quick
// succession must not have the second write undo the first.
function updateServer(
    serverId: string,
    update: (server: CustomServerType) => CustomServerType,
) {
    setCustomServers(
        getCustomServers().map((server) => {
            return server.id === serverId ? update(server) : server;
        }),
    );
}

function updateModel(
    serverId: string,
    rowId: string,
    update: (row: CustomModelType) => CustomModelType,
) {
    updateServer(serverId, (server) => {
        return {
            ...server,
            models: server.models.map((row) => {
                return row.id === rowId ? update(row) : row;
            }),
        };
    });
}

/**
 * What LM Studio said about one model, under its row: loaded or not, and
 * whether the context it is loaded with can hold the assistant. Nothing at
 * all for a server that is not LM Studio -- no other server says.
 */
function RenderModelInfoComp({
    info,
}: Readonly<{ info: LmStudioModelInfoType | undefined }>) {
    if (info === undefined) {
        return null;
    }
    if (!info.isLoaded || info.loadedContext === null) {
        return (
            <div className="app-setting-others-model-note app-data small">
                <i className="bi bi-moon me-1" />
                {tran(
                    'Not loaded in LM Studio right now. The first question waits for it to load.',
                )}
            </div>
        );
    }
    const loadedText = `${tran('Loaded in LM Studio. Context length:')} ${toContextLabel(info.loadedContext)}.`;
    if (info.loadedContext >= CUSTOM_CONTEXT_COMFORTABLE) {
        return (
            <div className="app-setting-others-model-note small text-success">
                <i className="bi bi-check-circle-fill me-1" />
                {loadedText}
            </div>
        );
    }
    const fixText = `${tran('In LM Studio, load this model again with a Context Length of')} ${toContextLabel(CUSTOM_CONTEXT_COMFORTABLE)}.`;
    return (
        <div className="app-setting-others-model-note small text-warning">
            <i className="bi bi-exclamation-triangle-fill me-1" />
            {loadedText}{' '}
            {info.loadedContext < CUSTOM_CONTEXT_MIN
                ? tran('That is too small for the assistant.')
                : tran('A follow-up question may not fit.')}{' '}
            {fixText}
        </div>
    );
}

function RenderModelRowComp({
    serverId,
    row,
    info,
}: Readonly<{
    serverId: string;
    row: CustomModelType;
    info: LmStudioModelInfoType | undefined;
}>) {
    const handleSavingModel = useCallback(
        (event: FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
            if (value !== row.model) {
                updateModel(serverId, row.id, (oldRow) => {
                    return { ...oldRow, model: value };
                });
            }
        },
        [serverId, row.id, row.model],
    );
    const handleSavingName = useCallback(
        (event: FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
            if (value !== row.name) {
                updateModel(serverId, row.id, (oldRow) => {
                    return { ...oldRow, name: value };
                });
            }
        },
        [serverId, row.id, row.name],
    );
    const handleDeleting = useCallback(() => {
        updateServer(serverId, (server) => {
            return {
                ...server,
                models: server.models.filter((one) => {
                    return one.id !== row.id;
                }),
            };
        });
    }, [serverId, row.id]);
    const handleSeeingChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const isChecked = event.target.checked;
            updateModel(serverId, row.id, (oldRow) => {
                const { canSeeImages: _old, ...rest } = oldRow;
                return isChecked ? { ...rest, canSeeImages: true } : rest;
            });
        },
        [serverId, row.id],
    );
    const seesId = `custom-model-sees-${row.id}`;
    return (
        <div className="app-setting-others-model-row">
            <input
                // Keyed by the stored value, like `SettingOthersFieldComp`,
                // so a write from "Load models" remounts it with the new one.
                key={`model-${row.model}`}
                className="form-control form-control-sm"
                defaultValue={row.model}
                placeholder={tran('Model id, as the server names it')}
                aria-label={tran('Model id')}
                onBlur={handleSavingModel}
            />
            <input
                key={`name-${row.name}`}
                className="form-control form-control-sm"
                defaultValue={row.name}
                placeholder={tran('Name shown in the chatbot (optional)')}
                aria-label={tran('Model name')}
                onBlur={handleSavingName}
            />
            <div
                className="form-check app-setting-others-model-sees"
                title={tran(
                    'Tick only if this model can look at a picture. Load models from server ticks it for you on LM Studio.',
                )}
            >
                <input
                    id={seesId}
                    className="form-check-input"
                    type="checkbox"
                    checked={row.canSeeImages === true}
                    onChange={handleSeeingChanging}
                />
                <label className="form-check-label small" htmlFor={seesId}>
                    {tran('Sees pictures')}
                </label>
            </div>
            <button
                className="btn btn-sm btn-outline-danger"
                type="button"
                title={tran('Remove this model')}
                aria-label={tran('Remove this model')}
                onClick={handleDeleting}
            >
                <i className="bi bi-x-lg" />
            </button>
            <RenderModelInfoComp info={info} />
        </div>
    );
}

type TestStateType =
    | { state: 'idle' }
    | { state: 'busy' }
    | { state: 'ok'; text: string }
    | { state: 'failed'; text: string };

function RenderServerStatusComp({
    server,
    testState,
}: Readonly<{ server: CustomServerType; testState: TestStateType }>) {
    if (testState.state === 'busy') {
        return (
            <div className="app-data small">
                <i className="bi bi-hourglass-split me-1" />
                {tran('Asking the server…')}
            </div>
        );
    }
    if (testState.state === 'ok') {
        return (
            <div className="small text-success">
                <i className="bi bi-check-circle-fill me-1" />
                {testState.text}
            </div>
        );
    }
    if (testState.state === 'failed') {
        return (
            <div className="small text-warning">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {testState.text}
            </div>
        );
    }
    // Before any test: what still stands between this server and the chatbot.
    if (
        server.baseUrl.length > 0 &&
        toCustomServerBaseUrl(server.baseUrl) === null
    ) {
        return (
            <div className="small text-warning">
                {tran(
                    'This is not a web address yet. It should look like http://localhost:1234/v1',
                )}
            </div>
        );
    }
    if (checkIsUsableCustomServer(server)) {
        return (
            <div className="small text-success">
                {tran('Offered in the chatbot')}
            </div>
        );
    }
    return (
        <div className="app-data small">
            {tran(
                'Give it a name, an address and at least one model to offer it in the chatbot.',
            )}
        </div>
    );
}

function RenderServerComp({ server }: Readonly<{ server: CustomServerType }>) {
    const [testState, setTestState] = useState<TestStateType>({
        state: 'idle',
    });
    // What LM Studio said at the last Test or Load -- held while the panel is
    // open, never stored: what is loaded changes whenever LM Studio is used.
    const [infoMap, setInfoMap] = useState<LmStudioModelInfoMapType | null>(
        null,
    );
    const handleSavingName = useCallback(
        (value: string) => {
            if (value !== server.name) {
                updateServer(server.id, (oldServer) => {
                    return { ...oldServer, name: value };
                });
            }
        },
        [server.id, server.name],
    );
    const handleSavingUrl = useCallback(
        (value: string) => {
            if (value !== server.baseUrl) {
                setTestState({ state: 'idle' });
                setInfoMap(null);
                updateServer(server.id, (oldServer) => {
                    return { ...oldServer, baseUrl: value };
                });
            }
        },
        [server.id, server.baseUrl],
    );
    const handleSavingKey = useCallback(
        (value: string) => {
            if (value !== getCustomServerKey(server.id)) {
                setCustomServerKey(server.id, value);
            }
        },
        [server.id],
    );
    // The STORED server, read at the press. The address box saves on blur,
    // and a press on this button is what blurs it -- so the box's value is
    // saved by the time this runs, while this render's `server` is not.
    const askServerModels = useCallback(async () => {
        const fresh = getCustomServers().find((one) => {
            return one.id === server.id;
        });
        if (fresh === undefined) {
            return null;
        }
        if (toCustomServerBaseUrl(fresh.baseUrl) === null) {
            setTestState({
                state: 'failed',
                text: tran(
                    'This is not a web address yet. It should look like http://localhost:1234/v1',
                ),
            });
            return null;
        }
        setTestState({ state: 'busy' });
        const answer = await listCustomServerModels(fresh);
        if (!answer.ok) {
            setInfoMap(null);
            setTestState({
                state: 'failed',
                text: `${tran('The server did not answer:')} ${answer.message}`,
            });
            return null;
        }
        // Only LM Studio says what it has loaded; anything else answers
        // null here and the rows say nothing more than before.
        const freshInfoMap = await readLmStudioModels(fresh);
        setInfoMap(freshInfoMap);
        return { models: answer.models, infoMap: freshInfoMap };
    }, [server.id]);
    const handleTesting = useCallback(async () => {
        const answer = await askServerModels();
        if (answer !== null) {
            setTestState({
                state: 'ok',
                text: `${tran('The server answered. Chat models it has:')} ${answer.models.length}`,
            });
        }
    }, [askServerModels]);
    const handleLoadingModels = useCallback(async () => {
        const answer = await askServerModels();
        if (answer === null) {
            return;
        }
        const { models } = answer;
        updateServer(server.id, (fresh) => {
            return mergeCustomServerModels(fresh, models, answer.infoMap);
        });
        setTestState({
            state: 'ok',
            text: `${tran('Models loaded from the server:')} ${models.length}`,
        });
    }, [askServerModels, server.id]);
    const handleAddingModel = useCallback(() => {
        updateServer(server.id, (oldServer) => {
            return {
                ...oldServer,
                models: [...oldServer.models, genCustomModelRow()],
            };
        });
    }, [server.id]);
    const handleDeleting = useCallback(() => {
        setCustomServerKey(server.id, '');
        setCustomServers(
            getCustomServers().filter((one) => {
                return one.id !== server.id;
            }),
        );
    }, [server.id]);
    // Never disabled for an address not yet saved: the press that would
    // save it lands on a disabled button and is lost, so the person has to
    // press twice. A bad address is said when pressed instead.
    const isBusy = testState.state === 'busy';
    return (
        <div className="app-setting-others-server">
            <div className="d-flex align-items-center gap-2 mb-2">
                <span className="app-setting-others-group-title m-0 flex-fill">
                    {server.name.length > 0 ? server.name : tran('New server')}
                    {' · '}
                    {tran('Models')}: {getUsableCustomModels(server).length}
                </span>
                <button
                    className="btn btn-sm btn-outline-danger"
                    type="button"
                    title={tran('Delete this server')}
                    aria-label={tran('Delete this server')}
                    onClick={handleDeleting}
                >
                    <i className="bi bi-trash" />
                </button>
            </div>
            <div className="app-setting-others-fields">
                <SettingOthersFieldComp
                    label={tran('Server name')}
                    hintKey="The name the chatbot shows for this server, such as LM Studio"
                    value={server.name}
                    onSave={handleSavingName}
                />
                <SettingOthersFieldComp
                    label={tran('Base URL')}
                    hintKey="The address that ends in /v1, such as http://localhost:1234/v1 for LM Studio"
                    value={server.baseUrl}
                    onSave={handleSavingUrl}
                />
                <SettingOthersFieldComp
                    label={tran('API key (optional)')}
                    hintKey="Only if the server asks for one. It is stored encrypted and never shown to the chatbot window."
                    value={getCustomServerKey(server.id)}
                    isSecret
                    onSave={handleSavingKey}
                />
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={isBusy}
                    onClick={handleTesting}
                >
                    <i className="bi bi-plug me-1" />
                    {tran('Test')}
                </button>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={isBusy}
                    onClick={handleLoadingModels}
                >
                    <i className="bi bi-cloud-download me-1" />
                    {tran('Load models from server')}
                </button>
                <RenderServerStatusComp server={server} testState={testState} />
            </div>
            <div className="app-setting-others-label mt-2">
                {tran('Models')}
            </div>
            <div className="app-setting-others-models">
                {server.models.map((row) => {
                    return (
                        <RenderModelRowComp
                            key={row.id}
                            serverId={server.id}
                            row={row}
                            info={infoMap?.get(row.model)}
                        />
                    );
                })}
                <div>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        disabled={server.models.length >= MAX_CUSTOM_MODELS}
                        onClick={handleAddingModel}
                    >
                        <i className="bi bi-plus-lg me-1" />
                        {tran('Add model')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SettingOthersCustomServersComp() {
    const servers = useCustomServers();
    const handleAdding = useCallback(() => {
        setCustomServers([...getCustomServers(), genCustomServer()]);
    }, []);
    return (
        <div className="app-setting-others-group app-setting-others-group-wide">
            <span className="app-setting-others-group-title">
                {tran('Custom servers')}
            </span>
            <div className="app-data small mb-2">
                {tran(
                    'Your own AI server, such as LM Studio or Ollama on this computer, or any service that speaks the OpenAI API. Each server shows in the chatbot as its own assistant.',
                )}
            </div>
            <div className="app-setting-others-group-fields">
                {servers.map((server) => {
                    return <RenderServerComp key={server.id} server={server} />;
                })}
            </div>
            <button
                className="btn btn-sm btn-outline-secondary mt-2"
                type="button"
                disabled={servers.length >= MAX_CUSTOM_SERVERS}
                onClick={handleAdding}
            >
                <i className="bi bi-plus-lg me-1" />
                {tran('Add server')}
            </button>
        </div>
    );
}
