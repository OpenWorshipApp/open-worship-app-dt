import { useState } from 'react';

import { controller, StatusDataType, StatusType } from './lwShareHelpers';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import { ensureDataDirectory } from '../setting/directory-setting/directoryHelpers';
import LoadingComp from '../others/LoadingComp';
import appProvider from '../server/appProvider';
import { showExplorer } from '../server/appHelpers';

function genStatusMessage({ status, message, data }: StatusDataType) {
    if (status === 'stopped') {
        return 'Server is stopped.';
    } else if (status === 'starting') {
        return 'Server is starting...';
    } else if (status === 'running') {
        return data!.addressesWithQRList.map(({ address, qrCode }) => {
            return (
                <div className="p-1 app-inner-shadow" key={address}>
                    <img src={qrCode} alt={`QRCode for ${address}`} />
                    <div>
                        <a
                            href={address}
                            onClick={(event) => {
                                event.preventDefault();
                                appProvider.browserUtils.openExternalURL(
                                    address,
                                );
                            }}
                        >
                            {address}
                        </a>
                    </div>
                </div>
            );
        });
    } else if (status === 'error') {
        return message ?? 'Error starting server.';
    }
}

const statusViewMap: { [key in StatusType]: { btn: string; text: string } } = {
    stopped: { btn: 'danger', text: 'Start Server' },
    starting: { btn: 'info', text: 'Starting Server...' },
    running: { btn: 'success', text: 'Stop Server' },
    error: { btn: 'warning', text: 'Restart Server' },
};

async function genNewServerData(
    port: number | undefined,
    setStatus: (status: StatusType) => void,
    setStatusData: (statusData: StatusDataType) => void,
) {
    const targetDir = await ensureDataDirectory('lw-share-data');
    if (targetDir === null) {
        return null;
    }
    return controller.initServer({
        port,
        targetDir,
        onStatus: (statusData) => {
            setStatus(statusData.status);
            setStatusData(statusData);
        },
    });
}

function CustomPortInputComp({
    port,
    setPort,
}: Readonly<{
    port: number | undefined;
    setPort: (port: number | undefined) => void;
}>) {
    return (
        <div>
            <label htmlFor="port-input">Custom Port:</label>
            <input
                id="port-input"
                className="mx-1 form-control form-control-sm"
                style={{
                    width: '80px',
                }}
                type="text"
                placeholder="Random"
                value={port ?? ''}
                onChange={(event) => {
                    const newPort = Number(event.target.value);
                    if (Number.isNaN(newPort) || newPort <= 0) {
                        setPort(undefined);
                        return;
                    }
                    setPort(newPort);
                }}
            />
            <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                    setPort(8080);
                }}
            >
                User 8080
            </button>
        </div>
    );
}

export default function ServerControllerComp() {
    const [statusData, setStatusData] = useState<StatusDataType>({
        status: 'stopped',
    });
    const [status, setStatus] = useState<StatusType>('stopped');
    const [port, setPort] = useState<number | undefined>(undefined);
    const [serverData, setServerData] = useAppStateAsync(async () => {
        return genNewServerData(port, setStatus, setStatusData);
    });
    useAppEffect(() => {
        if (port === undefined) {
            return;
        }
        serverData?.stop();
        genNewServerData(port, setStatus, setStatusData).then(
            (newServerData) => {
                setServerData(newServerData);
            },
        );
    }, [port]);
    if (serverData === undefined) {
        return <LoadingComp />;
    }
    if (serverData === null) {
        return <p>Fail to start server.</p>;
    }
    const handleServer = async () => {
        if (status === 'starting') {
            return;
        } else if (status === 'running') {
            serverData.stop();
        } else {
            serverData.restart();
        }
    };
    const statusView = statusViewMap[status];
    return (
        <div className="w-100 h-100 d-flex flex-column overflow-hidden">
            <CustomPortInputComp port={port} setPort={setPort} />
            <div>
                <hr />
                <div
                    className="w-100 overflow-hidden d-flex"
                    style={{
                        display: 'inline',
                        cursor: 'pointer',
                    }}
                    title={serverData.targetDir}
                    onClick={() => {
                        showExplorer(serverData.targetDir);
                    }}
                >
                    <div
                        style={{
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Storage Dir:
                    </div>
                    <div
                        className="px-1 flex-fill"
                        style={{
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {serverData.targetDir}
                    </div>
                </div>
                <hr />
                <span className="p-1">Port: {serverData.port}</span>
                <button
                    className={`btn btn-sm btn-${statusView.btn}`}
                    onClick={handleServer}
                >
                    {statusView.text}
                    {status === 'starting' && (
                        <span
                            className="spinner-border spinner-border-sm ms-2"
                            role="status"
                            aria-hidden="true"
                        ></span>
                    )}
                </button>
            </div>
            <div
                className="w-100 d-flex flex-wrap p-2"
                style={{
                    border: '1px solid #ccc',
                    borderBlockColor: '#ccc',
                    borderRadius: '4px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}
            >
                {genStatusMessage(statusData)}
            </div>
        </div>
    );
}
