import { useState } from 'react';
import { tran } from '../lang/langHelpers';
import type { MirrorNetwork } from '../../electron/screenMirrorProtocol';
import {
    mirrorCommand,
    toMirrorErrorText,
    useMirrorState,
} from './mirrorConnectionHelpers';
import ScreenMirrorAddressesComp from './ScreenMirrorAddressesComp';
import NetworkAccessNoticeComp from './NetworkAccessNoticeComp';

// Where a guest came from, on every guest and every request: the room must
// always see who is joining from outside it.
function MirrorNetworkBadgeComp({
    network,
}: Readonly<{ network: MirrorNetwork }>) {
    return network === 'internet' ? (
        <span className="badge text-bg-warning">
            <i className="bi bi-globe2 me-1" aria-hidden />
            {tran('Internet')}
        </span>
    ) : (
        <span className="badge text-bg-secondary">
            <i className="bi bi-house-door me-1" aria-hidden />
            {tran('This network')}
        </span>
    );
}

// The host's side: the floating panel opened from the Mini Screen list. The
// guest's side is its own page, `ScreenMirrorGuestComp`.
export default function ScreenMirrorConnectionComp() {
    const state = useMirrorState();
    const [hostCode, setHostCode] = useState('');
    const [customPort, setCustomPort] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
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
    if (!state) return <p>{tran('Screen mirror server is unavailable')}</p>;
    return (
        <div
            className="p-2 d-flex flex-column gap-2"
            style={{ overflow: 'auto', height: '100%' }}
        >
            {error && (
                <div role="alert" className="text-danger">
                    {error}
                </div>
            )}
            {state.error && (
                <div role="alert" className="text-danger">
                    {tran('Screen mirror server is unavailable')}
                </div>
            )}
            {/* Off by default: until it is on, no other computer can find
                or join this one. */}
            <div className="form-check form-switch">
                <input
                    id="app-mirror-host-switch"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={state.hostEnabled}
                    disabled={busy}
                    onChange={(event) => {
                        const enabled = event.target.checked;
                        void perform(() => {
                            return mirrorCommand('host', { enabled });
                        });
                    }}
                />
                <label
                    className="form-check-label"
                    htmlFor="app-mirror-host-switch"
                >
                    {tran('Let other computers connect')}
                </label>
            </div>
            {state.hostEnabled ? (
                <>
                    {/* Off by default, like hosting: until it is on, a guest
                        from outside this computer's own networks is refused. */}
                    <div className="form-check form-switch">
                        <input
                            id="app-mirror-internet-switch"
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={state.internetEnabled}
                            disabled={busy}
                            onChange={(event) => {
                                const enabled = event.target.checked;
                                void perform(() => {
                                    return mirrorCommand('internet', {
                                        enabled,
                                    });
                                });
                            }}
                        />
                        <label
                            className="form-check-label"
                            htmlFor="app-mirror-internet-switch"
                        >
                            {tran('Open to the internet')}
                        </label>
                    </div>
                    {state.internetEnabled ? (
                        <div className="alert alert-warning small py-1 px-2 mb-0">
                            {tran(
                                'Anyone who has the address can ask to connect, and the connection is not encrypted. Use a connection code, and turn this off when you are done.',
                            )}
                        </div>
                    ) : null}
                    <NetworkAccessNoticeComp port={state.port} />
                    <h5>{tran('Connected guests')}</h5>
                    {state.guests.length === 0 && (
                        <div>{tran('No connected guests')}</div>
                    )}
                    {state.guests.map((guest) => (
                        <div
                            key={guest.id}
                            className={
                                'border rounded p-2' +
                                (guest.network === 'internet'
                                    ? ' border-warning'
                                    : '')
                            }
                        >
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <strong>
                                    {guest.prefix}: {guest.name}
                                </strong>
                                <MirrorNetworkBadgeComp
                                    network={guest.network}
                                />
                            </div>
                            <div className="app-data">{guest.address}</div>
                            {guest.displays.map((display) => (
                                <div key={display.id}>
                                    {guest.prefix}: {display.bounds.width}x
                                    {display.bounds.height}
                                    {display.isPrimary
                                        ? ` (${tran('primary')})`
                                        : ''}
                                </div>
                            ))}
                            {guest.cameras.map((camera) => (
                                <div key={camera.deviceId}>{camera.label}</div>
                            ))}
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                    void perform(() =>
                                        mirrorCommand('disconnect-guest', {
                                            id: guest.id,
                                        }),
                                    )
                                }
                            >
                                {tran('Disconnect')}
                            </button>
                        </div>
                    ))}
                    {state.pending.map((guest) => (
                        <div
                            key={guest.id}
                            className={
                                'border rounded p-2' +
                                (guest.network === 'internet'
                                    ? ' border-warning'
                                    : '')
                            }
                        >
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <span>
                                    {tran('Connection request')}: {guest.name} (
                                    <span className="app-data">
                                        {guest.address}
                                    </span>
                                    )
                                </span>
                                <MirrorNetworkBadgeComp
                                    network={guest.network}
                                />
                            </div>
                            <button
                                className="btn btn-sm btn-primary me-2"
                                onClick={() =>
                                    void perform(() =>
                                        mirrorCommand('approve', {
                                            id: guest.id,
                                        }),
                                    )
                                }
                            >
                                {tran('Allow connection')}
                            </button>
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                    void perform(() =>
                                        mirrorCommand('reject', {
                                            id: guest.id,
                                        }),
                                    )
                                }
                            >
                                {tran('Reject connection')}
                            </button>
                        </div>
                    ))}
                    <ScreenMirrorAddressesComp
                        state={state}
                        busy={busy}
                        perform={perform}
                    />
                    <label>
                        {tran('Guest access')}
                        <select
                            className="form-select form-select-sm"
                            value={state.approvalMode}
                            onChange={(event) =>
                                void perform(() =>
                                    mirrorCommand('settings', {
                                        mode: event.target.value,
                                    }),
                                )
                            }
                        >
                            <option value="approve">
                                {tran('Approve each connection')}
                            </option>
                            <option value="code">
                                {tran('Require connection code')}
                            </option>
                        </select>
                    </label>
                    <label>
                        {tran('Connection code')}
                        <input
                            className="form-control form-control-sm"
                            type="password"
                            autoComplete="new-password"
                            value={hostCode}
                            placeholder={
                                state.hasCode ? tran('Code is set') : ''
                            }
                            onChange={(event) =>
                                setHostCode(event.target.value)
                            }
                        />
                    </label>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={!hostCode.trim() || busy}
                        onClick={() =>
                            void perform(async () => {
                                await mirrorCommand('settings', {
                                    mode: state.approvalMode,
                                    code: hostCode,
                                });
                                setHostCode('');
                            })
                        }
                    >
                        {tran('Set connection code')}
                    </button>
                    <label>
                        {tran('Custom port (next launch)')}
                        <input
                            className="form-control form-control-sm"
                            type="number"
                            min={1}
                            max={65535}
                            value={customPort}
                            placeholder={String(state.customPort ?? '')}
                            onChange={(event) =>
                                setCustomPort(event.target.value)
                            }
                        />
                    </label>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={busy}
                        onClick={() =>
                            void perform(() =>
                                mirrorCommand('settings', {
                                    mode: state.approvalMode,
                                    port: customPort
                                        ? Number(customPort)
                                        : null,
                                }),
                            )
                        }
                    >
                        {tran('Save port')}
                    </button>
                </>
            ) : (
                <p className="text-muted mb-0">
                    {tran(
                        'Turn this on to use other computers on this network as extra screens.',
                    )}
                </p>
            )}
        </div>
    );
}
