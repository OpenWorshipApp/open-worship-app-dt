import './ScreenMirrorGuestComp.scss';

import { memo, useRef, useState, type ReactNode } from 'react';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { goToPath } from '../router/routeHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getAllCameraDevices } from '../helper/cameraHelpers';
import { getAllDisplays } from '../_screen/managers/screenHelpers';
import {
    readMirrorAddressText,
    toMirrorDefaultPort,
    toMirrorHostPort,
    type MirrorConnectionStatus,
    type MirrorDiscovery,
    type MirrorState,
} from '../../electron/screenMirrorProtocol';
import {
    mirrorCommand,
    toMirrorErrorText,
    useMirrorState,
} from './mirrorConnectionHelpers';
import { findImageFile, readQrTextFromImage } from './mirrorQrHelpers';
import { layoutMirrorMonitors } from './mirrorMonitorLayout';
import MirrorIntercomComp from './MirrorIntercomComp';
import { isVirtualDisplayId } from '../../electron/virtualDisplayProtocol';

// `idle` is the patch drawn before any host is linked.
type LinkStatusType = MirrorConnectionStatus | 'idle';
type ScanStateType = 'idle' | 'scanning' | 'done';
type WireToneType = 'idle' | 'busy' | 'linked' | 'failed';

function toWireTone(status: LinkStatusType): WireToneType {
    if (status === 'connected') {
        return 'linked';
    }
    if (status === 'error') {
        return 'failed';
    }
    if (status === 'idle') {
        return 'idle';
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

// Looks once by itself when the page opens, so the volunteer opens it onto the
// hosts rather than onto an empty list -- linked to some already or not, since
// another host can always be added. A newer scan closes the one before it,
// which then resolves early with what it had: only the latest one may write
// its answer. The main process has already tried every network each host
// answered on and lists the best-reached first.
function useHostScan(onFound: (found: MirrorDiscovery[]) => void) {
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
        if (scanIdRef.current === 0) {
            void scan();
        }
    }, []);
    return { hosts, scanState, scan };
}

function readOwnMonitorLayout() {
    const { primaryDisplay, displays } = getAllDisplays();
    const ownDisplays = displays.filter((display) => {
        return (
            !(display as { guestId?: string }).guestId &&
            !isVirtualDisplayId(display.id)
        );
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
                                        box.width < 56 ? 'visually-hidden' : ''
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
function MirrorPageComp({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <div className="app-mirror-guest">
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

// One host and this computer, the wire between them IS the link's state.
function MirrorPatchComp({
    status,
    name,
    address,
    prefix,
    errorText,
    displayRevision,
    onDisconnect,
    intercom,
}: Readonly<{
    status: LinkStatusType;
    name: string;
    address: string;
    prefix: string;
    errorText: string;
    displayRevision: number;
    onDisconnect?: () => void;
    // The connection's talk-back and camera controls, once connected.
    intercom?: ReactNode;
}>) {
    const tone = toWireTone(status);
    const hint = toHintText(status);
    return (
        <section
            className="app-mirror-patch"
            data-tone={tone}
            aria-label={`${tran('Connection status')}${name || address ? `: ${name || address}` : ''}`}
        >
            <MirrorHostNodeComp name={name} address={address} />
            <p role="status" className="app-mirror-cable-status">
                {toStatusText(status)}
            </p>
            <div className="app-mirror-cable-wire" aria-hidden>
                <span className="app-mirror-cable-track">
                    {tone === 'busy' ? (
                        <span className="app-mirror-cable-pulse" />
                    ) : null}
                </span>
            </div>
            <div className="app-mirror-cable-action">
                {intercom}
                {errorText ? (
                    <p role="alert" className="app-mirror-cable-error">
                        {errorText}
                    </p>
                ) : null}
                {onDisconnect ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={onDisconnect}
                    >
                        {tran('Disconnect')}
                    </button>
                ) : null}
            </div>
            <MirrorThisComputerNodeComp
                key={displayRevision}
                prefix={prefix}
                isLinked={status === 'connected'}
            />
            {hint ? <p className="app-mirror-hint">{hint}</p> : null}
        </section>
    );
}

function MirrorLinkPatchComp({
    connection,
    displayRevision,
}: Readonly<{
    connection: MirrorState['connections'][number];
    displayRevision: number;
}>) {
    const [busy, setBusy] = useState(false);
    const command = async (action: string, data: Record<string, unknown>) => {
        setBusy(true);
        try {
            await mirrorCommand(action, data);
        } catch {
            // The state broadcast shows what took effect.
        } finally {
            setBusy(false);
        }
    };
    return (
        <MirrorPatchComp
            status={connection.status}
            name={connection.name}
            address={toMirrorHostPort(connection.host, connection.port)}
            prefix={connection.prefix}
            errorText={
                connection.error ? toMirrorErrorText(connection.error) : ''
            }
            displayRevision={displayRevision}
            onDisconnect={() => {
                void mirrorCommand('disconnect', { id: connection.id }).catch(
                    () => {},
                );
            }}
            intercom={
                connection.status === 'connected' ? (
                    <MirrorIntercomComp
                        intercom={connection.intercom}
                        busy={busy}
                        onChange={(change) => {
                            return command('intercom', {
                                key: `link:${connection.id}`,
                                ...change,
                            });
                        }}
                        camera={{
                            isShared: connection.shareCameras,
                            onToggle: () => {
                                void command('share-cameras', {
                                    id: connection.id,
                                    enabled: !connection.shareCameras,
                                });
                            },
                        }}
                    />
                ) : null
            }
        />
    );
}

function ScreenMirrorGuestBodyComp({
    state,
}: Readonly<{ state: MirrorState }>) {
    const { connections } = state;
    // A link that ended in an error (a wrong code, say) is not a link: its
    // host stays pickable so connecting again can replace it.
    const linkedHostIds = new Set(
        connections
            .filter((connection) => {
                return connection.status !== 'error';
            })
            .map((connection) => {
                return connection.hostId;
            }),
    );
    const linkedHostIdsRef = useAppCurrentRef(linkedHostIds);
    const [host, setHost] = useState('');
    // Text, not a number: clearing the box to retype it must not leave a 0.
    // Optional: empty dials the host's default -- 443 for a tunnel's address,
    // which shows none (asked for 2026-10-08), else Screen Mirror's first.
    const [portText, setPortText] = useState('');
    // What a scan filled in, so the next scan may replace it -- but never an
    // address the volunteer typed or a host they picked themselves.
    const autoFilledRef = useRef('');
    const { hosts, scanState, scan } = useHostScan((found) => {
        const best = found.find((item) => {
            return !!item.host && !linkedHostIdsRef.current.has(item.id);
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
    const fileInputRef = useRef<HTMLInputElement>(null);
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
    const fillAddress = (text: string) => {
        const parsed = readMirrorAddressText(text);
        if (parsed === null) {
            return false;
        }
        setHost(parsed.host);
        if (parsed.port !== null) {
            setPortText(String(parsed.port));
        }
        autoFilledRef.current = '';
        return true;
    };
    // An address someone sent as a picture of its QR code fills the form.
    const readImage = (file: Blob) => {
        setBusy(true);
        setError('');
        void readQrTextFromImage(file)
            .catch(() => {
                return null;
            })
            .then((text) => {
                if (!text || !fillAddress(text)) {
                    setError(tran('No host address found in this image.'));
                }
            })
            .finally(() => {
                setBusy(false);
            });
    };
    // Whatever was copied -- `host:port`, a whole link, or a picture of the
    // QR code -- fills the address and the port in one press.
    const pasteAddress = async () => {
        setError('');
        try {
            for (const item of await navigator.clipboard.read()) {
                const imageType = item.types.find((type) => {
                    return type.startsWith('image/');
                });
                if (imageType !== undefined) {
                    readImage(await item.getType(imageType));
                    return;
                }
            }
            if (fillAddress(await navigator.clipboard.readText())) {
                return;
            }
        } catch {}
        setError(tran('No host address found in the clipboard.'));
    };
    // The address box takes `host:port` and whole links too; a port in it
    // wins over the port box.
    const typed = readMirrorAddressText(host);
    const typedHost = typed?.host ?? host.trim();
    const defaultPort = toMirrorDefaultPort(typedHost);
    const port =
        typed?.port ??
        (portText.trim() === '' ? defaultPort : Number(portText));
    const isPortValid = Number.isInteger(port) && port >= 1 && port <= 65535;
    const canConnect = !busy && typedHost !== '' && isPortValid;
    const connect = () => {
        if (typed?.port) {
            setHost(typed.host);
            setPortText(String(typed.port));
        }
        void perform(async () => {
            await getAllCameraDevices();
            await mirrorCommand('connect', { host: typedHost, port, code });
        });
    };
    const knownHost = typedHost
        ? hosts.find((item) => {
              return item.host === typedHost && item.port === port;
          })
        : undefined;
    return (
        <MirrorPageComp>
            <h1>{tran('Screen Mirror')}</h1>
            {state.error ? (
                <p role="alert" className="app-mirror-alert">
                    {tran('Screen mirror server is unavailable')}
                </p>
            ) : null}
            {connections.length === 0 ? (
                <MirrorPatchComp
                    status="idle"
                    name={knownHost?.name ?? ''}
                    address={typedHost ? toMirrorHostPort(typedHost, port) : ''}
                    prefix=""
                    errorText=""
                    displayRevision={state.displayRevision}
                />
            ) : (
                connections.map((connection) => {
                    return (
                        <MirrorLinkPatchComp
                            key={connection.id}
                            connection={connection}
                            displayRevision={state.displayRevision}
                        />
                    );
                })
            )}
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
                            <i className="bi bi-arrow-clockwise" aria-hidden />{' '}
                            {tran('Rescan')}
                        </button>
                    </div>
                    {hosts.length > 0 ? (
                        <ul className="app-mirror-host-list">
                            {hosts.map((item) => {
                                const isLinked = linkedHostIds.has(item.id);
                                const isSelected =
                                    item.host === typedHost &&
                                    item.port === port;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className="app-mirror-host"
                                            aria-pressed={isSelected}
                                            disabled={isLinked}
                                            onClick={() => {
                                                setHost(item.host ?? '');
                                                setPortText(String(item.port));
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
                                                {isLinked
                                                    ? tran('Connected')
                                                    : `${item.host}:${item.port}`}
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
                    onPaste={(event) => {
                        const image = findImageFile(event.clipboardData?.items);
                        if (image !== null) {
                            event.preventDefault();
                            readImage(image);
                        }
                    }}
                >
                    <div className="app-mirror-section-head">
                        <h2 id="app-mirror-address-title">
                            {tran('Connect by address')}
                        </h2>
                        <span className="app-mirror-head-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={busy}
                                title={tran(
                                    'Fill in a copied address, link or QR code picture.',
                                )}
                                onClick={() => {
                                    void pasteAddress();
                                }}
                            >
                                <i className="bi bi-clipboard" aria-hidden />{' '}
                                {tran('Paste address')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={busy}
                                title={tran(
                                    'Choose a picture of a QR code, or paste one here.',
                                )}
                                onClick={() => {
                                    fileInputRef.current?.click();
                                }}
                            >
                                <i className="bi bi-qr-code-scan" aria-hidden />{' '}
                                {tran('Read QR code')}
                            </button>
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) {
                                    readImage(file);
                                }
                            }}
                        />
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
                                onPaste={(event) => {
                                    const parsed = readMirrorAddressText(
                                        event.clipboardData.getData('text'),
                                    );
                                    if (parsed?.port) {
                                        event.preventDefault();
                                        setHost(parsed.host);
                                        setPortText(String(parsed.port));
                                    }
                                }}
                            />
                        </label>
                        <label className="app-mirror-field">
                            <span>{tran('Port (optional)')}</span>
                            <input
                                className="form-control form-control-sm app-data"
                                aria-label={tran('Port')}
                                type="number"
                                min={1}
                                max={65535}
                                value={portText}
                                placeholder={String(defaultPort)}
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
                            {tran('Leave empty unless the host uses a code.')}
                        </small>
                    </label>
                    <button
                        type="submit"
                        className="btn btn-primary app-mirror-connect"
                        disabled={!canConnect}
                    >
                        {tran('Connect')}
                    </button>
                    {error ? (
                        <p role="alert" className="app-mirror-cable-error">
                            {error}
                        </p>
                    ) : null}
                </form>
            </div>
        </MirrorPageComp>
    );
}

// The guest's side of Screen Mirror: this computer offers its monitors to one
// host or several, each on its own link. The host's side is
// `ScreenMirrorConnectionComp`. What it shows of a live link comes from the
// main process, which outlives this page.
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
