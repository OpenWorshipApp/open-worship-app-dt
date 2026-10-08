import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';

import { tran } from '../lang/langHelpers';
import {
    MAX_VIRTUAL_DISPLAYS,
    type VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';
import { mirrorCommand } from '../screen-mirror/mirrorConnectionHelpers';
import { MirrorRouterStatusComp } from '../screen-mirror/MirrorNetworkComps';
import NetworkAccessNoticeComp from '../screen-mirror/NetworkAccessNoticeComp';
import {
    toVirtualDisplayErrorText,
    useVirtualDisplayState,
    virtualDisplayCommand,
} from './virtualDisplayHelpers';
import VirtualDisplayCardComp from './VirtualDisplayCardComp';

export type VirtualDisplayPerformType = (
    work: () => Promise<unknown>,
) => Promise<void>;

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
                            <div className="alert alert-warning small py-1 px-2 mb-0">
                                {tran(
                                    'Anyone who has a stream address can watch it, and the stream is not encrypted. Turn this off when you are done.',
                                )}
                            </div>
                            <MirrorRouterStatusComp
                                state={state}
                                busy={isBusy}
                                perform={perform}
                            />
                        </>
                    ) : null}
                    <NetworkAccessNoticeComp port={state.port} />
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
