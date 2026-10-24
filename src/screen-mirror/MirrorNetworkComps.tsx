import { useState } from 'react';
import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    toMirrorHostPort,
    type MirrorRouterStatus,
} from '../../electron/screenMirrorProtocol';
import { mirrorCommand } from './mirrorConnectionHelpers';
import CollapsibleNoteComp from './CollapsibleNoteComp';

type QrCodeType = { size: number; path: string };
export type PerformType = (work: () => Promise<unknown>) => Promise<void>;

// The QR code as a picture to send someone: drawn 8 pixels to a module with
// the address written under it, so whoever receives it can also read it.
// Chromium's async clipboard takes `image/png` alone. The canvas is let go
// at once.
async function copyQrImage(code: QrCodeType, text: string) {
    const scale = 8;
    const side = code.size * scale;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side + 40;
    try {
        const context = canvas.getContext('2d');
        if (context === null) {
            throw new Error('No canvas');
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000';
        context.font = '24px sans-serif';
        context.textAlign = 'center';
        context.fillText(text, side / 2, side + 22, side - 16);
        context.scale(scale, scale);
        context.fill(new Path2D(code.path));
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
        if (blob === null) {
            throw new Error('No picture');
        }
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
        ]);
        showSimpleToast(
            tran('Copy image'),
            tran('The QR code image has been copied to the clipboard'),
        );
    } catch {
        showSimpleToast(
            tran('Copy image'),
            tran('The QR code image could not be copied'),
        );
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

// An address as a QR code: Screen Mirror's plain `host:port` a guest types
// (text to copy, not a link to open), or a virtual display's stream URL. Black on white in either theme: a scanner needs the light
// quiet zone around it. Asked for only while it is showing.
export function MirrorQrCodeComp({ text }: Readonly<{ text: string }>) {
    const [code, setCode] = useState<QrCodeType | null>(null);
    const [isFailed, setIsFailed] = useState(false);
    useAppEffect(() => {
        let isCurrent = true;
        mirrorCommand<QrCodeType>('qr', { text }).then(
            (value) => {
                if (isCurrent) {
                    setCode(value);
                }
            },
            () => {
                if (isCurrent) {
                    setIsFailed(true);
                }
            },
        );
        return () => {
            isCurrent = false;
        };
    }, [text]);
    if (isFailed) {
        return (
            <p className="small text-danger mb-0">
                {tran('Connection failed')}
            </p>
        );
    }
    if (code === null) {
        return null;
    }
    return (
        <figure className="d-flex flex-column align-items-center gap-1 m-0 py-1">
            <svg
                viewBox={`0 0 ${code.size} ${code.size}`}
                width={180}
                height={180}
                role="img"
                aria-label={`${tran('QR code')}: ${text}`}
                shapeRendering="crispEdges"
            >
                <rect width={code.size} height={code.size} fill="#fff" />
                <path d={code.path} fill="#000" />
            </svg>
            <figcaption className="small app-data">{text}</figcaption>
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                aria-label={`${tran('Copy image')}: ${text}`}
                onClick={() => {
                    void copyQrImage(code, text);
                }}
            >
                <i className="bi bi-copy me-1" aria-hidden />
                {tran('Copy image')}
            </button>
        </figure>
    );
}

type RouterStatePropsType = {
    router: MirrorRouterStatus;
    port: number;
    publicPort: number | null;
    addresses: { host: string; port: number; kind: string }[];
};

// The public port to ask the router for, or to forward by hand: empty means
// this computer's own. Saving asks the router again at once.
function RenderPublicPortComp({
    state,
    busy,
    perform,
}: Readonly<{
    state: RouterStatePropsType;
    busy: boolean;
    perform: PerformType;
}>) {
    const [text, setText] = useState('');
    const port = Number(text);
    const isValid =
        text === '' || (Number.isInteger(port) && port > 0 && port <= 65535);
    return (
        <label className="small d-flex flex-column gap-1">
            <span>{tran('Public port')}</span>
            <span className="input-group input-group-sm">
                <input
                    className="form-control app-data"
                    type="number"
                    min={1}
                    max={65535}
                    value={text}
                    placeholder={String(state.publicPort ?? state.port)}
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
                            await mirrorCommand('public-port', {
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

function RenderRouterStatusComp({
    state,
    busy,
    perform,
}: Readonly<{
    state: RouterStatePropsType;
    busy: boolean;
    perform: PerformType;
}>) {
    const lan = state.addresses.find((address) => {
        return address.kind === 'lan';
    });
    if (state.router === 'working') {
        return (
            <p className="small text-muted mb-0" role="status">
                <span
                    className="spinner-border spinner-border-sm me-1"
                    aria-hidden
                />
                {tran('Asking the router to open the port…')}
            </p>
        );
    }
    if (state.router === 'open') {
        // The public port can differ from this computer's: another computer
        // behind the same router may already hold that one.
        const router = state.addresses.find((address) => {
            return address.kind === 'router';
        });
        return (
            <div className="small d-flex flex-column gap-1" role="status">
                <p className="text-success mb-0">
                    <i className="bi bi-check-circle me-1" aria-hidden />
                    {tran('The router opened the port.')}
                </p>
                {router &&
                state.publicPort !== null &&
                router.port !== state.publicPort ? (
                    <p className="text-warning mb-0">
                        {tran(
                            'The router would not open the chosen port, so it opened another one.',
                        )}
                    </p>
                ) : null}
                {router && lan ? (
                    <span className="app-data text-muted">
                        {toMirrorHostPort(router.host, router.port)} →{' '}
                        {toMirrorHostPort(lan.host, state.port)}
                    </span>
                ) : null}
            </div>
        );
    }
    // Folded to its first line: the advice, the ports and the retry are there
    // for whoever opens it.
    return (
        <div className="small" role="status">
            <CollapsibleNoteComp
                settingName="virtual-screens-note-router-expanded"
                className="text-warning"
            >
                {state.router === 'shared' ? (
                    <p className="mb-0">
                        {tran(
                            'This router is behind another network, so the internet cannot reach it. A VPN such as Tailscale works instead.',
                        )}
                    </p>
                ) : (
                    <>
                        <p className="mb-0">
                            {state.router === 'unavailable'
                                ? tran('No router answered.')
                                : tran(
                                      'The router refused to open the port.',
                                  )}{' '}
                            {tran(
                                'Forward the port on the router to this computer, then type the public address below.',
                            )}
                        </p>
                        {lan ? (
                            <p className="app-data text-muted mb-1">
                                {state.publicPort ?? state.port} →{' '}
                                {toMirrorHostPort(lan.host, state.port)}
                            </p>
                        ) : null}
                    </>
                )}
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy}
                    onClick={() => {
                        void perform(() => {
                            return mirrorCommand('router');
                        });
                    }}
                >
                    <i className="bi bi-arrow-clockwise me-1" aria-hidden />
                    {tran('Ask the router again')}
                </button>
            </CollapsibleNoteComp>
        </div>
    );
}

// What the router said about forwarding the port, and the public port to use.
// Shared by both tabs: Screen Mirror's hosting and Virtual Displays' sharing
// open the same server.
export function MirrorRouterStatusComp({
    state,
    busy,
    perform,
}: Readonly<{
    state: RouterStatePropsType;
    busy: boolean;
    perform: PerformType;
}>) {
    if (state.router === 'off') {
        return null;
    }
    return (
        <div className="d-flex flex-column gap-2">
            <RenderRouterStatusComp
                state={state}
                busy={busy}
                perform={perform}
            />
            <RenderPublicPortComp state={state} busy={busy} perform={perform} />
        </div>
    );
}
