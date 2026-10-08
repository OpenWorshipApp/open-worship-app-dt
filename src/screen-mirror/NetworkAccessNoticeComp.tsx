import { useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { copyToClipboard } from '../server/appHelpers';
import type { MirrorFirewallStatus } from '../../electron/screenMirrorProtocol';
import { mirrorCommand } from './mirrorConnectionHelpers';

function RenderWindowsStepsComp({
    status,
}: Readonly<{ status: MirrorFirewallStatus }>) {
    const names =
        status.ruleNames.length > 0 ? status.ruleNames : [status.appName];
    return (
        <ol className="mb-0 ps-3">
            <li>{tran('Click Open firewall settings.')}</li>
            <li>{tran('Click Change settings.')}</li>
            <li>
                {tran(
                    'Find this app in the list and tick Private. Tick Public too if this network is public.',
                )}{' '}
                <span className="app-data fw-bold">{names.join(', ')}</span>
            </li>
            <li>{tran('Click OK, then Check again.')}</li>
        </ol>
    );
}

function RenderMacStepsComp({
    status,
}: Readonly<{ status: MirrorFirewallStatus }>) {
    return (
        <ol className="mb-0 ps-3">
            <li>{tran('Click Open firewall settings.')}</li>
            <li>{tran('Click Options.')}</li>
            <li>
                {tran(
                    'Find this app and set it to allow incoming connections, and turn off blocking all incoming connections.',
                )}{' '}
                <span className="app-data fw-bold">{status.appName}</span>
            </li>
            <li>{tran('Click OK, then Check again.')}</li>
        </ol>
    );
}

function RenderLinuxHintComp({ port }: Readonly<{ port: number }>) {
    const command = `sudo ufw allow ${port}/tcp`;
    return (
        <div className="small text-muted d-flex flex-column gap-1">
            <span>
                {tran(
                    'If another device cannot connect, allow this port in the firewall:',
                )}
            </span>
            <span className="d-flex align-items-center gap-1">
                <code className="app-data">{command}</code>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={tran('Copy')}
                    aria-label={`${tran('Copy')}: ${command}`}
                    onClick={() => {
                        void copyToClipboard(command, tran('Copy'));
                    }}
                >
                    <i className="bi bi-copy" aria-hidden />
                </button>
            </span>
        </div>
    );
}

// Whether the operating system's firewall lets other devices reach this app,
// and how to give access back when it does not. Shown only while something
// here is open to the network; the check itself runs in the main process, on
// demand, and its answer is kept there a minute.
export default function NetworkAccessNoticeComp({
    port,
}: Readonly<{ port: number }>) {
    const [status, setStatus] = useState<MirrorFirewallStatus | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const check = (isForced: boolean) => {
        setIsChecking(true);
        mirrorCommand<MirrorFirewallStatus>('firewall', { isForced })
            .then(setStatus, () => {
                setStatus(null);
            })
            .finally(() => {
                setIsChecking(false);
            });
    };
    useAppEffect(() => {
        check(false);
    }, [port]);
    const isProblem =
        status !== null &&
        ['blocked', 'blocked-public', 'not-allowed'].includes(status.verdict);
    // The operator gives access in another window; coming back here is the
    // moment to look again.
    useAppEffect(() => {
        if (!isProblem) {
            return;
        }
        const listener = () => {
            attemptTimeout(() => {
                check(true);
            });
        };
        window.addEventListener('focus', listener);
        return () => {
            window.removeEventListener('focus', listener);
        };
    }, [isProblem]);
    if (status === null) {
        return null;
    }
    const checkAgainButton = (
        <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={isChecking}
            onClick={() => {
                check(true);
            }}
        >
            <i className="bi bi-arrow-clockwise me-1" aria-hidden />
            {tran('Check again')}
        </button>
    );
    if (status.verdict === 'ok') {
        return null;
    }
    if (status.verdict === 'unknown') {
        if (status.platform === 'linux') {
            return <RenderLinuxHintComp port={status.port} />;
        }
        return null;
    }
    const openSettings = (target: 'firewall' | 'network') => {
        void mirrorCommand('open-firewall-settings', { target });
    };
    return (
        <div
            className="alert alert-warning small py-2 px-2 mb-0 d-flex flex-column gap-2"
            role="alert"
        >
            <strong>
                <i className="bi bi-shield-exclamation me-1" aria-hidden />
                {status.verdict === 'blocked-public'
                    ? tran(
                          'This network is set as Public, and the firewall lets this app in only on private networks.',
                      )
                    : tran(
                          'The firewall is stopping other devices from reaching this app.',
                      )}
            </strong>
            {status.verdict === 'blocked-public' ? (
                <span>
                    {tran(
                        'Set this network to Private, or allow this app on public networks in the firewall.',
                    )}
                </span>
            ) : null}
            {status.platform === 'win32' ? (
                <RenderWindowsStepsComp status={status} />
            ) : null}
            {status.platform === 'darwin' ? (
                <RenderMacStepsComp status={status} />
            ) : null}
            <span className="text-muted">
                {tran(
                    'Another security program on this computer may need to allow this app too.',
                )}
            </span>
            <div className="d-flex flex-wrap gap-1">
                {status.platform === 'win32' || status.platform === 'darwin' ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-warning"
                        onClick={() => {
                            openSettings('firewall');
                        }}
                    >
                        <i className="bi bi-shield-check me-1" aria-hidden />
                        {tran('Open firewall settings')}
                    </button>
                ) : null}
                {status.verdict === 'blocked-public' &&
                status.platform === 'win32' ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                            openSettings('network');
                        }}
                    >
                        <i className="bi bi-wifi me-1" aria-hidden />
                        {tran('Open network settings')}
                    </button>
                ) : null}
                {checkAgainButton}
            </div>
        </div>
    );
}
