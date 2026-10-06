import './ScreenMirrorGuestComp.scss';

import { memo, useRef, useState, type ReactNode } from 'react';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { goToPath } from '../router/routeHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getAllCameraDevices } from '../helper/cameraHelpers';
import { getAllDisplays } from '../_screen/managers/screenHelpers';
import {
    MIRROR_PORT_FIRST,
    type MirrorDiscovery,
    type MirrorState,
} from '../../electron/screenMirrorProtocol';
import {
    mirrorCommand,
    toMirrorErrorText,
    useMirrorState,
} from './mirrorConnectionHelpers';
import { layoutMirrorMonitors } from './mirrorMonitorLayout';

type LinkStatusType = MirrorState['connection']['status'];
type ScanStateType = 'idle' | 'scanning' | 'done';
type WireToneType = 'idle' | 'busy' | 'linked' | 'failed';

function checkIsIdle(status: LinkStatusType) {
    return status === 'disconnected' || status === 'error';
}

function toWireTone(status: LinkStatusType, hasError: boolean): WireToneType {
    if (status === 'connected') {
        return 'linked';
    }
    if (checkIsIdle(status)) {
        return hasError ? 'failed' : 'idle';
    }
    return 'busy';
}

function toStatusText(status: LinkStatusType) {
    if (status === 'connected') {
        return tran('Connected');
    }
    if (status === 'pending') {
        return tran('Waiting for host approval');
    }
    if (status === 'connecting' || status === 'reconnecting') {
        return tran('Connecting');
    }
    return tran('Disconnected');
}

function toHintText(status: LinkStatusType) {
    if (status === 'pending') {
        return tran('On the host, click Allow connection.');
    }
    if (status === 'connected') {
        return tran('The host can now show its screens on these monitors.');
    }
    return '';
}

// A camera plugged in here reaches the host's camera list without a reconnect.
function useCameraDeviceRefresh() {
    useAppEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const refresh = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                void getAllCameraDevices().catch(() => {});
            }, 500);
        };
        navigator.mediaDevices?.addEventListener('devicechange', refresh);
        return () => {
            clearTimeout(timer);
            navigator.mediaDevices?.removeEventListener(
                'devicechange',
                refresh,
            );
        };
    }, []);
}

// Looks once by itself the first time the page has nothing connected, so the
// volunteer opens it onto the hosts rather than onto an empty list. A newer
// scan closes the one before it, which then resolves early with what it had:
// only the latest one may write its answer. The main process has already
// tried every network each host answered on and lists the best-reached first.
function useHostScan(
    isIdle: boolean,
    onFound: (found: MirrorDiscovery[]) => void,
) {
    const onFoundRef = useAppCurrentRef(onFound);
    const [hosts, setHosts] = useState<MirrorDiscovery[]>([]);
    const [scanState, setScanState] = useState<ScanStateType>('idle');
    const scanIdRef = useRef(0);
    const scan = async () => {
        const scanId = ++scanIdRef.current;
        setScanState('scanning');
        const found = await mirrorCommand<MirrorDiscovery[]>('scan').catch(
            () => {
                return [] as MirrorDiscovery[];
            },
        );
        if (scanId !== scanIdRef.current) {
            return;
        }
        setHosts(found);
        setScanState('done');
        onFoundRef.current(found);
    };
    useAppEffect(() => {
        if (isIdle && scanIdRef.current === 0) {
            void scan();
        }
    }, [isIdle]);
    return { hosts, scanState, scan };
}

function readOwnMonitorLayout() {
    const { primaryDisplay, displays } = getAllDisplays();
    const ownDisplays = displays.filter((display) => {
        return !(display as { guestId?: string }).guestId;
    });
    return layoutMirrorMonitors(
        ownDisplays,
        primaryDisplay?.id ?? null,
        168,
        64,
    );
}

// Memoised so typing in the address form does not re-ask the main process for
// the monitors on every key; they are read again when the link changes, and
// remounted (keyed on `displayRevision`) when a monitor is added or removed.
const MirrorThisComputerNodeComp = memo(function MirrorThisComputerNodeComp({
    prefix,
    isLinked,
}: Readonly<{ prefix: string; isLinked: boolean }>) {
    const layout = readOwnMonitorLayout();
    return (
        <>
            <span className="app-mirror-node-label app-mirror-this-label">
                {tran('This computer')}
            </span>
            <div
                className={
                    'app-mirror-this-value' + (isLinked ? ' is-linked' : '')
                }
            >
                {prefix ? (
                    <span className="app-mirror-prefix">{prefix}</span>
                ) : null}
                <ul
                    className="app-mirror-monitors"
                    style={{ width: layout.width, height: layout.height }}
                >
                    {layout.boxes.map((box) => {
                        const title = box.isPrimary
                            ? `${box.resolution} (${tran('primary')})`
                            : box.resolution;
                        return (
                            <li
                                key={box.id}
                                className={
                                    'app-mirror-monitor app-data' +
                                    (box.isPrimary ? ' is-primary' : '')
                                }
                                title={title}
                                style={{
                                    left: box.left,
                                    top: box.top,
                                    width: Math.max(box.width - 3, 4),
                                    height: Math.max(box.height - 3, 4),
                                }}
                            >
                                <span
                                    className={
                                        box.width < 64 ? 'visually-hidden' : ''
                                    }
                                >
                                    {box.resolution}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </>
    );
});

function MirrorHostNodeComp({
    name,
    address,
}: Readonly<{ name: string; address: string }>) {
    return (
        <>
            <span className="app-mirror-node-label app-mirror-host-label">
                {tran('Host')}
            </span>
            <div className="app-mirror-host-value">
                {name ? (
                    <span className="app-mirror-node-name">{name}</span>
                ) : null}
                {address ? (
                    <span
                        className={
                            'app-data ' +
                            (name
                                ? 'app-mirror-node-address'
                                : 'app-mirror-node-name')
                        }
                    >
                        {address}
                    </span>
                ) : null}
                {!name && !address ? (
                    <span className="app-mirror-node-empty">
                        {tran('Choose a host below')}
                    </span>
                ) : null}
            </div>
        </>
    );
}

// The page's whole frame: one way out, back to the Presenter, and the column.
function MirrorPageComp({
    tone,
    children,
}: Readonly<{ tone?: WireToneType; children: ReactNode }>) {
    return (
        <div className="app-mirror-guest" data-tone={tone}>
            <nav className="app-mirror-topbar">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                        goToPath(appProvider.presenterHomePage);
                    }}
                >
                    <i className="bi bi-arrow-left" aria-hidden />{' '}
                    {tran('Presenter')}
                </button>
            </nav>
            <main className="app-mirror-guest-scroll">
                <div className="app-mirror-guest-column">{children}</div>
            </main>
        </div>
    );
}

function ScreenMirrorGuestBodyComp({
    state,
}: Readonly<{ state: MirrorState }>) {
    const { connection } = state;
    const isIdle = checkIsIdle(connection.status);
    const [host, setHost] = useState('');
    // Text, not a number: clearing the box to retype it must not leave a 0.
    const [portText, setPortText] = useState(String(MIRROR_PORT_FIRST));
    // What a scan filled in, so the next scan may replace it -- but never an
    // address the volunteer typed or a host they picked themselves.
    const autoFilledRef = useRef('');
    const { hosts, scanState, scan } = useHostScan(isIdle, (found) => {
        const best = found.find((item) => {
            return !!item.host;
        });
        const typed = host.trim();
        if (
            !best?.host ||
            (typed !== '' && `${typed}:${portText}` !== autoFilledRef.current)
        ) {
            return;
        }
        setHost(best.host);
        setPortText(String(best.port));
        autoFilledRef.current = `${best.host}:${best.port}`;
    });
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useCameraDeviceRefresh();
    async function perform(work: () => Promise<unknown>) {
        setBusy(true);
        setError('');
        try {
            await work();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? toMirrorErrorText(cause.message)
                    : tran('Connection failed'),
            );
        } finally {
            setBusy(false);
        }
    }
    const typedHost = host.trim();
    const port = Number(portText);
    const isPortValid = Number.isInteger(port) && port >= 1 && port <= 65535;
    const canConnect = !busy && typedHost !== '' && isPortValid && isIdle;
    const connect = () => {
        void perform(async () => {
            await getAllCameraDevices();
            await mirrorCommand('connect', { host: typedHost, port, code });
        });
    };
    const errorText =
        error || (connection.error ? toMirrorErrorText(connection.error) : '');
    const tone = toWireTone(connection.status, errorText !== '');
    const linkHost = isIdle ? typedHost : connection.host;
    const linkPort = isIdle ? port : connection.port;
    const knownHost = linkHost
        ? hosts.find((item) => {
              return item.host === linkHost && item.port === linkPort;
          })
        : undefined;
    const hint = toHintText(connection.status);
    return (
        <MirrorPageComp tone={tone}>
            <h1>{tran('Screen Mirror')}</h1>
            {state.error ? (
                <p role="alert" className="app-mirror-alert">
                    {tran('Screen mirror server is unavailable')}
                </p>
            ) : null}
            <section
                className="app-mirror-patch"
                aria-label={tran('Connection status')}
            >
                <MirrorHostNodeComp
                    name={knownHost?.name ?? (isIdle ? '' : connection.name)}
                    address={linkHost ? `${linkHost}:${linkPort}` : ''}
                />
                <p role="status" className="app-mirror-cable-status">
                    {toStatusText(connection.status)}
                </p>
                <div className="app-mirror-cable-wire" aria-hidden>
                    <span className="app-mirror-cable-track">
                        {tone === 'busy' ? (
                            <span className="app-mirror-cable-pulse" />
                        ) : null}
                    </span>
                </div>
                <div className="app-mirror-cable-action">
                    {errorText ? (
                        <p role="alert" className="app-mirror-cable-error">
                            {errorText}
                        </p>
                    ) : null}
                    {connection.status === 'disconnected' ? null : (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                void perform(() => {
                                    return mirrorCommand('disconnect');
                                });
                            }}
                        >
                            {tran('Disconnect')}
                        </button>
                    )}
                </div>
                <MirrorThisComputerNodeComp
                    key={state.displayRevision}
                    prefix={isIdle ? '' : connection.prefix}
                    isLinked={connection.status === 'connected'}
                />
                {hint ? <p className="app-mirror-hint">{hint}</p> : null}
            </section>
            {isIdle ? (
                <div className="app-mirror-finder">
                    <section aria-labelledby="app-mirror-hosts-title">
                        <div className="app-mirror-section-head">
                            <h2 id="app-mirror-hosts-title">
                                {tran('Hosts on this network')}
                            </h2>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={scanState === 'scanning'}
                                onClick={() => {
                                    void scan();
                                }}
                            >
                                <i
                                    className="bi bi-arrow-clockwise"
                                    aria-hidden
                                />{' '}
                                {tran('Rescan')}
                            </button>
                        </div>
                        {hosts.length > 0 ? (
                            <ul className="app-mirror-host-list">
                                {hosts.map((item) => {
                                    const isSelected =
                                        item.host === typedHost &&
                                        item.port === port;
                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                className="app-mirror-host"
                                                aria-pressed={isSelected}
                                                onClick={() => {
                                                    setHost(item.host ?? '');
                                                    setPortText(
                                                        String(item.port),
                                                    );
                                                }}
                                            >
                                                <span className="app-mirror-host-name">
                                                    {item.name}
                                                </span>
                                                {/* Otherwise the name and address are read as one word. */}
                                                <span className="visually-hidden">
                                                    ,{' '}
                                                </span>
                                                <span className="app-mirror-host-address app-data">
                                                    {item.host}:{item.port}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="app-mirror-empty">
                                {scanState === 'done'
                                    ? tran(
                                          'No host found. Open the app on the host and check that both computers are on the same network.',
                                      )
                                    : tran('Looking for hosts…')}
                            </p>
                        )}
                    </section>
                    <form
                        className="app-mirror-address"
                        aria-labelledby="app-mirror-address-title"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (canConnect) {
                                connect();
                            }
                        }}
                    >
                        <div className="app-mirror-section-head">
                            <h2 id="app-mirror-address-title">
                                {tran('Connect by address')}
                            </h2>
                        </div>
                        <div className="app-mirror-address-row">
                            <label className="app-mirror-field">
                                <span>{tran('Host address')}</span>
                                <input
                                    className="form-control form-control-sm app-data"
                                    aria-label={tran('Host address')}
                                    spellCheck={false}
                                    value={host}
                                    onChange={(event) => {
                                        setHost(event.target.value);
                                    }}
                                />
                            </label>
                            <label className="app-mirror-field">
                                <span>{tran('Port')}</span>
                                <input
                                    className="form-control form-control-sm app-data"
                                    aria-label={tran('Port')}
                                    type="number"
                                    min={1}
                                    max={65535}
                                    value={portText}
                                    onChange={(event) => {
                                        setPortText(event.target.value);
                                    }}
                                />
                            </label>
                        </div>
                        <label className="app-mirror-field">
                            <span>{tran('Connection code')}</span>
                            <input
                                className="form-control form-control-sm"
                                aria-label={tran('Connection code')}
                                type="password"
                                autoComplete="off"
                                aria-describedby="app-mirror-code-hint"
                                value={code}
                                onChange={(event) => {
                                    setCode(event.target.value);
                                }}
                            />
                            <small id="app-mirror-code-hint">
                                {tran(
                                    'Leave empty unless the host uses a code.',
                                )}
                            </small>
                        </label>
                        <button
                            type="submit"
                            className="btn btn-primary app-mirror-connect"
                            disabled={!canConnect}
                        >
                            {tran('Connect')}
                        </button>
                    </form>
                </div>
            ) : null}
        </MirrorPageComp>
    );
}

// The guest's side of Screen Mirror: this computer offers its monitors to a
// host on the same network. The host's side is `ScreenMirrorConnectionComp`.
// What it shows of a live link comes from the main process, which outlives
// this page: a page opened onto a connection has scanned nothing.
export default function ScreenMirrorGuestComp() {
    const state = useMirrorState();
    if (state === null) {
        return (
            <MirrorPageComp>
                <p role="alert" className="app-mirror-alert">
                    {tran('Screen mirror server is unavailable')}
                </p>
            </MirrorPageComp>
        );
    }
    return <ScreenMirrorGuestBodyComp state={state} />;
}
