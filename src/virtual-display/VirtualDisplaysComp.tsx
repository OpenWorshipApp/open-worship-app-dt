import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';

import { tran } from '../lang/langHelpers';
import {
    MAX_VIRTUAL_DISPLAYS,
    type VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';
import { mirrorCommand } from '../screen-mirror/mirrorConnectionHelpers';
import { MirrorRouterStatusComp } from '../screen-mirror/MirrorNetworkComps';
import {
    MirrorCustomPortComp,
    MirrorGuestAccessComp,
    MirrorInternetWarningComp,
    MirrorPublicAddressComp,
    MirrorTunnelComp,
} from '../screen-mirror/MirrorInternetComps';
import NetworkAccessNoticeComp from '../screen-mirror/NetworkAccessNoticeComp';
import CollapsibleNoteComp from '../screen-mirror/CollapsibleNoteComp';
import {
    toVirtualDisplayErrorText,
    useVirtualDisplayState,
    virtualDisplayCommand,
} from './virtualDisplayHelpers';
import VirtualDisplayCardComp from './VirtualDisplayCardComp';

export type VirtualDisplayPerformType = (
    work: () => Promise<unknown>,
) => Promise<void>;

// Off by default. A browser on another device watching over plain http is
// not a secure context, so its page cannot keep the screen awake in full
// screen, send a microphone or share a camera; over https it can. The port
// stays the same, and plain http keeps answering for media players.
function RenderHttpsSwitchComp({
    state,
    isBusy,
    perform,
}: Readonly<{
    state: VirtualDisplayState;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
}>) {
    return (
        <div className="d-flex flex-column gap-1">
            <div className="form-check form-switch mb-0">
                <input
                    id="app-virtual-display-https-switch"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={state.httpsEnabled}
                    disabled={isBusy}
                    onChange={(event) => {
                        const enabled = event.target.checked;
                        void perform(() => {
                            return virtualDisplayCommand('https', { enabled });
                        });
                    }}
                />
                <label
                    className="form-check-label"
                    htmlFor="app-virtual-display-https-switch"
                >
                    {tran('Use HTTPS')}
                </label>
            </div>
            <CollapsibleNoteComp
                settingName="virtual-screens-note-https-expanded"
                className="small text-muted"
            >
                {tran(
                    'Browsers on other devices open the display by an https address, so a phone can keep its screen on and share its microphone and camera. This computer signs its own certificate, so each browser warns once: continue past the warning (Advanced, then Proceed). Media players keep the http address.',
                )}
            </CollapsibleNoteComp>
        </div>
    );
}

function RenderShareSwitchesComp({
    state,
    isBusy,
    perform,
}: Readonly<{
    state: VirtualDisplayState;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
}>) {
    return (
        <>
            {/* Off by default: until it is on, only this computer can watch. */}
            <div className="form-check form-switch">
                <input
                    id="app-virtual-display-share-switch"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={state.shareEnabled}
                    disabled={isBusy}
                    onChange={(event) => {
                        const enabled = event.target.checked;
                        void perform(() => {
                            return virtualDisplayCommand('share', { enabled });
                        });
                    }}
                />
                <label
                    className="form-check-label"
                    htmlFor="app-virtual-display-share-switch"
                >
                    {tran('Let other devices watch')}
                </label>
            </div>
            {state.shareEnabled ? (
                <>
                    <RenderHttpsSwitchComp
                        state={state}
                        isBusy={isBusy}
                        perform={perform}
                    />
                    {/* The same option as Screen Mirror's: one server. */}
                    <div className="form-check form-switch">
                        <input
                            id="app-virtual-display-internet-switch"
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={state.internetEnabled}
                            disabled={isBusy}
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
                            htmlFor="app-virtual-display-internet-switch"
                        >
                            {tran('Open to the internet')}
                        </label>
                    </div>
                    {state.internetEnabled ? (
                        <>
                            <MirrorInternetWarningComp />
                            {/* A viewer from the internet is let in by
                                the operator or by the code; this computer's
                                own networks come in as before. */}
                            <MirrorGuestAccessComp
                                mode={state.access}
                                hasCode={state.hasCode}
                                busy={isBusy}
                                onMode={(mode) => {
                                    return perform(() => {
                                        return virtualDisplayCommand('access', {
                                            mode,
                                        });
                                    });
                                }}
                                onCode={(code) => {
                                    return perform(() => {
                                        return virtualDisplayCommand('code', {
                                            code,
                                        });
                                    });
                                }}
                            />
                            <MirrorTunnelComp
                                state={state}
                                busy={isBusy}
                                perform={perform}
                                idPrefix="app-virtual-display"
                            />
                            <MirrorRouterStatusComp
                                state={state}
                                busy={isBusy}
                                perform={perform}
                            />
                            <MirrorPublicAddressComp
                                publicAddress={state.publicAddress}
                                busy={isBusy}
                                perform={perform}
                            />
                        </>
                    ) : null}
                    <NetworkAccessNoticeComp port={state.port} />
                    <MirrorCustomPortComp
                        customPort={state.customPort}
                        busy={isBusy}
                        perform={perform}
                    />
                </>
            ) : (
                <p className="small text-muted mb-0">
                    {tran(
                        'Turn this on to watch virtual displays from phones, TVs and other computers on this network.',
                    )}
                </p>
            )}
        </>
    );
}

// The Virtual Displays tab of the Virtual Screens Manager: monitors that exist
// only inside this app, each streamed as a live video for whoever opens its
// address.
export default function VirtualDisplaysComp() {
    const state = useVirtualDisplayState();
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState('');
    const [createdNumber, setCreatedNumber] = useState<number | null>(null);
    // A browser watching a display has no dictionary of its own: it is
    // handed these, in the language this app is in.
    useAppEffect(() => {
        void virtualDisplayCommand('labels', {
            labels: {
                fullScreen: tran('Full screen'),
                exitFullScreen: tran('Exit full screen'),
                sound: tran('Turn on sound'),
                waiting: tran('Waiting for the display'),
                disconnected: tran(
                    'This device was disconnected. Ask whoever runs the display to let it back in.',
                ),
                waitingApproval: tran('Waiting for host approval'),
                code: tran('Connection code'),
                connect: tran('Connect'),
                wrongCode: tran('Connection code is incorrect'),
                locked: tran('Too many wrong codes. Try again later.'),
                retry: tran('Retry'),
                empty: tran('Nothing is showing on this display yet.'),
                mic: tran('Send my microphone'),
                soundOff: tran('Turn off sound'),
                voiceVolume: tran('Voice volume'),
                cast: tran('Cast to a TV'),
                castFailed: tran(
                    'No TV was found that can play this display. It must be on and on the same network.',
                ),
                castSearching: tran('Looking for TVs…'),
                castSearchAgain: tran('Search again'),
                castStart: tran('Cast'),
                castStop: tran('Stop'),
                castConnecting: tran('Connecting'),
                casting: tran('Casting'),
                castCouldNot: tran('The TV could not play this display.'),
                castNeedsSharing: tran(
                    'Turn on “Let other devices watch” to cast to a TV.',
                ),
                castFromBrowser: tran('Cast from this browser'),
                castBrowserHint: tran(
                    'For a TV on the same network as this device.',
                ),
                castNoBrowserTv: tran(
                    'This browser found no TV. It must be on and on the same network as this device.',
                ),
                castNoBrowser: tran(
                    'This browser cannot cast. Try Chrome, Edge or Safari.',
                ),
                castAppTvs: tran('TVs on the app’s network'),
                close: tran('Close'),
                camera: tran('Share my cameras'),
                cameraShare: tran('Share'),
                cameraStop: tran('Stop'),
                cameraName: tran('Camera'),
                cameraFront: tran('Front camera'),
                cameraBack: tran('Back camera'),
                micFailed: tran(
                    'The microphone could not be opened. Allow it for this page, or close another app using it.',
                ),
                cameraFailed: tran(
                    'The camera could not be opened. Allow it for this page, or close another app using it.',
                ),
            },
        }).catch(() => {});
    }, []);
    const perform: VirtualDisplayPerformType = async (work) => {
        setIsBusy(true);
        setError('');
        try {
            await work();
        } catch (cause) {
            setError(
                toVirtualDisplayErrorText(
                    cause instanceof Error ? cause.message : String(cause),
                ),
            );
        } finally {
            setIsBusy(false);
        }
    };
    if (state === null || !state.available) {
        return (
            <p className="p-2 text-danger mb-0" role="alert">
                {tran('Screen mirror server is unavailable')}
            </p>
        );
    }
    const isFull = state.displays.length >= MAX_VIRTUAL_DISPLAYS;
    return (
        <div
            className="p-2 d-flex flex-column gap-2"
            style={{ overflow: 'auto', height: '100%' }}
        >
            {error ? (
                <div role="alert" className="text-danger">
                    {error}
                </div>
            ) : null}
            <RenderShareSwitchesComp
                state={state}
                isBusy={isBusy}
                perform={perform}
            />
            <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">{tran('Virtual Displays')}</h6>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={isBusy || isFull}
                    title={isFull ? tran('Too many virtual displays') : ''}
                    onClick={() => {
                        void perform(async () => {
                            const before = new Set(
                                state.displays.map((display) => display.number),
                            );
                            const next = await virtualDisplayCommand('create', {
                                name: tran('Virtual Display'),
                                width: 1920,
                                height: 1080,
                                wallpaper: { kind: 'none' },
                            });
                            const created = next.displays.find((display) => {
                                return !before.has(display.number);
                            });
                            if (created !== undefined) {
                                setCreatedNumber(created.number);
                            }
                        });
                    }}
                >
                    <i className="bi bi-plus-lg me-1" aria-hidden />
                    {tran('Add Virtual Display')}
                </button>
            </div>
            {state.displays.length === 0 ? (
                <p className="small text-muted mb-0">
                    {tran(
                        'A virtual display is a screen that exists only in this app. Show screens on it like on a real monitor, and watch it from any device as a video.',
                    )}
                </p>
            ) : null}
            {state.displays.map((display) => {
                return (
                    <VirtualDisplayCardComp
                        key={display.number}
                        display={display}
                        state={state}
                        isJustCreated={createdNumber === display.number}
                        isBusy={isBusy}
                        perform={perform}
                    />
                );
            })}
        </div>
    );
}
