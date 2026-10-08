import { useState } from 'react';
import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    toMirrorHostPort,
    type MirrorRouterStatus,
} from '../../electron/screenMirrorProtocol';
import { mirrorCommand } from './mirrorConnectionHelpers';

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

// What the router said about forwarding the port. Shared by both tabs: Screen
// Mirror's hosting and Virtual Displays' sharing open the same server.
export function MirrorRouterStatusComp({
    state,
    busy,
    perform,
}: Readonly<{
    state: {
        router: MirrorRouterStatus;
        port: number;
        addresses: { host: string; port: number; kind: string }[];
    };
    busy: boolean;
    perform: PerformType;
}>) {
    const lan = state.addresses.find((address) => {
        return address.kind === 'lan';
    });
    if (state.router === 'off') {
        return null;
    }
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
        return (
            <p className="small text-success mb-0" role="status">
                <i className="bi bi-check-circle me-1" aria-hidden />
                {tran('The router opened the port.')}
            </p>
        );
    }
    return (
        <div className="small d-flex flex-column gap-1" role="status">
            {state.router === 'shared' ? (
                <p className="text-warning mb-0">
                    {tran(
                        'This router is behind another network, so the internet cannot reach it. A VPN such as Tailscale works instead.',
                    )}
                </p>
            ) : (
                <>
                    <p className="text-warning mb-0">
                        {state.router === 'unavailable'
                            ? tran('No router answered.')
                            : tran('The router refused to open the port.')}{' '}
                        {tran(
                            'Forward the port on the router to this computer, then type the public address below.',
                        )}
                    </p>
                    {lan ? (
                        <span className="app-data text-muted">
                            {state.port} →{' '}
                            {toMirrorHostPort(lan.host, state.port)}
                        </span>
                    ) : null}
                </>
            )}
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary align-self-start"
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
        </div>
    );
}
