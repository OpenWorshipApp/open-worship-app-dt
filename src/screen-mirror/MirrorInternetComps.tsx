import { useState } from 'react';

import { tran } from '../lang/langHelpers';
import type { MirrorTunnelState } from '../../electron/screenMirrorProtocol';
import { mirrorCommand } from './mirrorConnectionHelpers';
import type { PerformType } from './MirrorNetworkComps';
import CollapsibleNoteComp from './CollapsibleNoteComp';

// The warning under "Open to the internet": the same server in both tabs of
// the panel, so the same words, folded the same way.
export function MirrorInternetWarningComp() {
    return (
        <CollapsibleNoteComp
            settingName="virtual-screens-note-internet-expanded"
            className="alert alert-warning small py-1 px-2 mb-0"
        >
            {tran(
                'Anyone who has the address can ask to connect, and the connection is not encrypted. Use a connection code, and turn this off when you are done.',
            )}
        </CollapsibleNoteComp>
    );
}

// The connection settings both tabs of the Virtual Screens Manager share --
// Screen Mirror's guests and virtual display viewers come in through the same
// server, so they are offered the same ways in. Each tab keeps its own guest
// access; the tunnel, public address and port are the server's, one for both.

export type AccessModeType = 'approve' | 'code';

// Who is let in: the operator allows each one, or they give the code. A code
// mode with no code set lets no one in, and says so.
export function MirrorGuestAccessComp({
    mode,
    hasCode,
    busy,
    onMode,
    onCode,
}: Readonly<{
    mode: AccessModeType;
    hasCode: boolean;
    busy: boolean;
    onMode: (mode: AccessModeType) => Promise<unknown>;
    onCode: (code: string) => Promise<unknown>;
}>) {
    const [code, setCode] = useState('');
    return (
        <div className="small d-flex flex-column gap-1">
            <label className="d-flex flex-column gap-1">
                {tran('Guest access')}
                <select
                    className="form-select form-select-sm"
                    value={mode}
                    disabled={busy}
                    onChange={(event) => {
                        void onMode(event.target.value as AccessModeType);
                    }}
                >
                    <option value="approve">
                        {tran('Approve each connection')}
                    </option>
                    <option value="code">
                        {tran('Require connection code')}
                    </option>
                </select>
            </label>
            {mode === 'code' ? (
                <label className="d-flex flex-column gap-1">
                    {tran('Connection code')}
                    <span className="input-group input-group-sm">
                        <input
                            className="form-control"
                            type="password"
                            autoComplete="new-password"
                            maxLength={64}
                            value={code}
                            placeholder={hasCode ? tran('Code is set') : ''}
                            onChange={(event) => {
                                setCode(event.target.value);
                            }}
                        />
                        <button
                            type="button"
                            className="btn btn-outline-primary"
                            disabled={busy || !code.trim()}
                            onClick={() => {
                                void onCode(code).then(() => {
                                    setCode('');
                                });
                            }}
                        >
                            {tran('Set connection code')}
                        </button>
                    </span>
                </label>
            ) : null}
            {mode === 'code' && !hasCode ? (
                <span className="text-warning">
                    {tran(
                        'Set a connection code: until then no one can come in with a code.',
                    )}
                </span>
            ) : null}
        </div>
    );
}

function toTunnelErrorText(code: MirrorTunnelState['error']) {
    if (code === 'missing') {
        return tran(
            'The tunnel comes with the Extra Binaries. Install or update them in Settings, and it starts by itself.',
        );
    }
    if (code === 'stopped') {
        return tran('The tunnel stopped. It starts again by itself.');
    }
    return tran('The tunnel is not working.');
}

// Cloudflare's quick tunnel: an https address that reaches this computer
// with nothing coming in -- for a VPN, carrier NAT or a router that forwards
// no port. Its address joins the address lists once it is up.
export function MirrorTunnelComp({
    state,
    busy,
    perform,
    idPrefix,
}: Readonly<{
    state: { tunnelEnabled: boolean; tunnel: MirrorTunnelState };
    busy: boolean;
    perform: PerformType;
    // Each tab's own, for the switch's label.
    idPrefix: string;
}>) {
    const { tunnel } = state;
    const switchId = `${idPrefix}-tunnel-switch`;
    return (
        <div className="small d-flex flex-column gap-1">
            <div className="form-check form-switch mb-0">
                <input
                    id={switchId}
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={state.tunnelEnabled}
                    disabled={busy}
                    onChange={(event) => {
                        const enabled = event.target.checked;
                        void perform(() => {
                            return mirrorCommand('tunnel', { enabled });
                        });
                    }}
                />
                <label className="form-check-label" htmlFor={switchId}>
                    {tran('Share through a Cloudflare tunnel')}
                </label>
            </div>
            <CollapsibleNoteComp
                settingName="virtual-screens-note-tunnel-expanded"
                className="text-muted"
            >
                {tran(
                    'For when the internet cannot reach this computer, such as behind a VPN or a router that forwards no port. Guests and viewers come in through Cloudflare by an https address that changes each time the tunnel starts.',
                )}
            </CollapsibleNoteComp>
            {state.tunnelEnabled ? (
                <span
                    className={
                        tunnel.status === 'up'
                            ? 'text-success'
                            : tunnel.status === 'error'
                              ? 'text-warning'
                              : 'text-muted'
                    }
                    role="status"
                >
                    {tunnel.status === 'starting'
                        ? tran('Starting the tunnel…')
                        : tunnel.status === 'up'
                          ? tran('The tunnel is up.')
                          : tunnel.status === 'error'
                            ? toTunnelErrorText(tunnel.error)
                            : null}
                </span>
            ) : null}
            {state.tunnelEnabled &&
            tunnel.status === 'error' &&
            tunnel.error === 'missing' ? (
                <span>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                            // Dynamic, so this panel never carries the
                            // settings page's dependencies.
                            void import('../setting/settingHelpers').then(
                                ({ openOthersSetting }) => {
                                    openOthersSetting();
                                },
                            );
                        }}
                    >
                        <i className="bi bi-hdd-stack me-1" />
                        {tran('Go to Settings')}
                    </button>
                </span>
            ) : null}
        </div>
    );
}

// The public address or DDNS name the operator knows this network by, listed
// beside the others (with the public port when it names none).
export function MirrorPublicAddressComp({
    publicAddress,
    busy,
    perform,
}: Readonly<{
    publicAddress: string;
    busy: boolean;
    perform: PerformType;
}>) {
    const [text, setText] = useState('');
    return (
        <div className="small d-flex flex-column gap-1">
            <span>{tran('Public address (optional)')}</span>
            <span className="input-group input-group-sm">
                <input
                    className="form-control app-data"
                    aria-label={tran('Public address (optional)')}
                    spellCheck={false}
                    value={text}
                    placeholder={publicAddress || 'example.ddns.net'}
                    onChange={(event) => {
                        setText(event.target.value);
                    }}
                />
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={busy}
                    onClick={() => {
                        void perform(async () => {
                            await mirrorCommand('public-address', { text });
                            setText('');
                        });
                    }}
                >
                    {tran('Save address')}
                </button>
            </span>
        </div>
    );
}

// This computer's own port, from the next launch; empty for the first free
// one of Screen Mirror's.
export function MirrorCustomPortComp({
    customPort,
    busy,
    perform,
}: Readonly<{
    customPort: number | null;
    busy: boolean;
    perform: PerformType;
}>) {
    const [text, setText] = useState('');
    const port = Number(text);
    const isValid =
        text === '' || (Number.isInteger(port) && port > 0 && port <= 65535);
    return (
        <label className="small d-flex flex-column gap-1">
            {tran('Custom port (next launch)')}
            <span className="input-group input-group-sm">
                <input
                    className="form-control app-data"
                    type="number"
                    min={1}
                    max={65535}
                    value={text}
                    placeholder={String(customPort ?? '')}
                    onChange={(event) => {
                        setText(event.target.value);
                    }}
                />
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={busy || !isValid}
                    onClick={() => {
                        void perform(async () => {
                            await mirrorCommand('custom-port', {
                                port: text === '' ? null : port,
                            });
                            setText('');
                        });
                    }}
                >
                    {tran('Save port')}
                </button>
            </span>
        </label>
    );
}
