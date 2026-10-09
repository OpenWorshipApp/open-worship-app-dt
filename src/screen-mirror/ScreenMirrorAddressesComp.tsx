import { useState } from 'react';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import {
    toMirrorAddressText,
    toMirrorHostPort,
    type MirrorAddress,
    type MirrorState,
} from '../../electron/screenMirrorProtocol';
import {
    MirrorQrCodeComp,
    MirrorRouterStatusComp,
    type PerformType,
} from './MirrorNetworkComps';
import {
    MirrorPublicAddressComp,
    MirrorTunnelComp,
} from './MirrorInternetComps';

function toKindLabel(kind: MirrorAddress['kind']) {
    if (kind === 'router') {
        return tran('Router');
    }
    if (kind === 'internet') {
        return 'IPv6';
    }
    if (kind === 'typed') {
        return tran('Public address');
    }
    if (kind === 'public') {
        return tran('Public IP');
    }
    if (kind === 'tunnel') {
        return tran('Tunnel');
    }
    return '';
}

function MirrorAddressRowComp({
    address,
    isQrShowing,
    onToggleQr,
}: Readonly<{
    address: MirrorAddress;
    isQrShowing: boolean;
    onToggleQr: () => void;
}>) {
    // Shown and copied as a guest types it -- a tunnel's whole https link;
    // the QR code stays plain host:port (the user's rule), port 443 meaning
    // TLS to a guest that reads it.
    const text = toMirrorAddressText(address);
    const qrText = toMirrorHostPort(address.host, address.port);
    const kindLabel = toKindLabel(address.kind);
    return (
        <li className="d-flex flex-column">
            <div className="d-flex align-items-center gap-1">
                <span className="app-data text-break flex-grow-1">{text}</span>
                {kindLabel ? (
                    <span className="badge text-bg-secondary">{kindLabel}</span>
                ) : null}
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={tran('Copy address')}
                    aria-label={`${tran('Copy address')}: ${text}`}
                    onClick={() => {
                        void copyToClipboard(text, tran('Copy address'));
                    }}
                >
                    <i className="bi bi-copy" aria-hidden />
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={tran('QR code')}
                    aria-label={`${tran('QR code')}: ${text}`}
                    aria-pressed={isQrShowing}
                    onClick={onToggleQr}
                >
                    <i className="bi bi-qr-code" aria-hidden />
                </button>
            </div>
            {isQrShowing ? <MirrorQrCodeComp text={qrText} /> : null}
        </li>
    );
}

// Every address this host can be reached on, each with its copy and QR code:
// this computer's own networks first, then -- once the internet is open --
// the ones from outside.
export default function ScreenMirrorAddressesComp({
    state,
    busy,
    perform,
}: Readonly<{ state: MirrorState; busy: boolean; perform: PerformType }>) {
    const [qrText, setQrText] = useState('');
    const renderList = (list: MirrorAddress[]) => {
        return (
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {list.map((address) => {
                    const text = toMirrorHostPort(address.host, address.port);
                    return (
                        <MirrorAddressRowComp
                            key={`${address.kind}:${text}`}
                            address={address}
                            isQrShowing={qrText === text}
                            onToggleQr={() => {
                                setQrText(qrText === text ? '' : text);
                            }}
                        />
                    );
                })}
            </ul>
        );
    };
    const internetList = state.addresses.filter((address) => {
        return address.kind !== 'lan';
    });
    return (
        <section
            className="d-flex flex-column gap-2"
            aria-label={tran('Host addresses')}
        >
            <div className="d-flex justify-content-between align-items-baseline">
                <h6 className="mb-0">{tran('Host addresses')}</h6>
                <span className="small text-muted">
                    {tran('Port')}:{' '}
                    <span className="app-data">{state.port}</span>
                </span>
            </div>
            <div className="small text-muted">
                <i className="bi bi-house-door me-1" aria-hidden />
                {tran('This network')}
            </div>
            {renderList(
                state.addresses.filter((address) => {
                    return address.kind === 'lan';
                }),
            )}
            {state.internetEnabled ? (
                <>
                    <div className="small text-muted mt-1">
                        <i className="bi bi-globe2 me-1" aria-hidden />
                        {tran('Internet')}
                    </div>
                    {internetList.length > 0 ? renderList(internetList) : null}
                    {internetList.some((address) => {
                        return address.kind === 'internet';
                    }) ? (
                        <p className="small text-muted mb-0">
                            {tran(
                                'An IPv6 address works only if the router lets incoming connections through.',
                            )}
                        </p>
                    ) : null}
                    <MirrorTunnelComp
                        state={state}
                        busy={busy}
                        perform={perform}
                        idPrefix="app-mirror"
                    />
                    <MirrorRouterStatusComp
                        state={state}
                        busy={busy}
                        perform={perform}
                    />
                    <MirrorPublicAddressComp
                        publicAddress={state.publicAddress}
                        busy={busy}
                        perform={perform}
                    />
                </>
            ) : null}
        </section>
    );
}
