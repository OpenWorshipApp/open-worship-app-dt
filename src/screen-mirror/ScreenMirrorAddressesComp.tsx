import { useState } from 'react';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import {
    toMirrorHostPort,
    type MirrorAddress,
    type MirrorState,
} from '../../electron/screenMirrorProtocol';
import { mirrorCommand } from './mirrorConnectionHelpers';
import {
    MirrorQrCodeComp,
    MirrorRouterStatusComp,
    type PerformType,
} from './MirrorNetworkComps';

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
    const text = toMirrorHostPort(address.host, address.port);
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
            {isQrShowing ? <MirrorQrCodeComp text={text} /> : null}
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
    const [publicText, setPublicText] = useState('');
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
                    <MirrorRouterStatusComp
                        state={state}
                        busy={busy}
                        perform={perform}
                    />
                    <div className="small d-flex flex-column gap-1">
                        <span>{tran('Public address (optional)')}</span>
                        <span className="input-group input-group-sm">
                            <input
                                className="form-control app-data"
                                aria-label={tran('Public address (optional)')}
                                spellCheck={false}
                                value={publicText}
                                placeholder={
                                    state.publicAddress || 'example.ddns.net'
                                }
                                onChange={(event) => {
                                    setPublicText(event.target.value);
                                }}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-primary"
                                disabled={busy}
                                onClick={() => {
                                    void perform(async () => {
                                        await mirrorCommand('settings', {
                                            mode: state.approvalMode,
                                            publicAddress: publicText,
                                        });
                                        setPublicText('');
                                    });
                                }}
                            >
                                {tran('Save address')}
                            </button>
                        </span>
                    </div>
                </>
            ) : null}
        </section>
    );
}
