import { lazy, useMemo, useState, type ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { selectFiles, toBaseNameOfAnyOs } from '../server/fileHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppEffect } from '../helper/appHooks';
import {
    removeSetting,
    useStateSettingBoolean,
} from '../helper/settingHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { MirrorQrCodeComp } from '../screen-mirror/MirrorNetworkComps';
import MirrorIntercomComp from '../screen-mirror/MirrorIntercomComp';
import { mirrorCommand } from '../screen-mirror/mirrorConnectionHelpers';
import {
    RESOLUTION_PRESETS,
    VIRTUAL_DISPLAY_IMAGE_EXTENSIONS,
    VIRTUAL_DISPLAY_MAX_SIDE,
    VIRTUAL_DISPLAY_MIN_SIDE,
    VIRTUAL_DISPLAY_VIDEO_EXTENSIONS,
    clampResolution,
    toVirtualDisplayPageUrl,
    toVirtualDisplayStreamUrl,
    type VirtualDisplayAddress,
    type VirtualDisplayClient,
    type VirtualDisplayInfo,
    type VirtualDisplayState,
    type VirtualDisplayWallpaper,
} from '../../electron/virtualDisplayProtocol';
import {
    toVirtualDisplayErrorText,
    virtualDisplayCommand,
} from './virtualDisplayHelpers';
import type { VirtualDisplayPerformType } from './VirtualDisplaysComp';
import VirtualDisplayCastComp, {
    VirtualDisplayCastButtonComp,
} from './VirtualDisplayCastComp';
import {
    splitVirtualDisplayAddresses,
    toViewerDeviceLabel,
} from './virtualDisplayAddressHelpers';

const LazyPreviewComp = lazy(() => import('./VirtualDisplayPreviewComp'));

type PropsType = Readonly<{
    display: VirtualDisplayInfo;
    state: VirtualDisplayState;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
}>;

// What is folded in a card is remembered per display. A display's number is
// never given to another one, so its keys cannot open someone else's card,
// and deleting the display clears them.
const FOLD_PARTS = ['card', 'settings', 'addresses', 'more-addresses'] as const;
type FoldPartType = (typeof FOLD_PARTS)[number];

function toFoldSettingName(number: number, part: FoldPartType) {
    return `virtual-display-${number}-${part}-expanded`;
}

function clearFoldSettings(number: number) {
    for (const part of FOLD_PARTS) {
        removeSetting(toFoldSettingName(number, part));
    }
}

// A part of a card that folds under its title. Folded, what is in it is not
// mounted at all.
function RenderFoldComp({
    number,
    part,
    title,
    icon,
    isExpandedByDefault = true,
    children,
}: Readonly<{
    number: number;
    part: FoldPartType;
    title: string;
    icon: string;
    isExpandedByDefault?: boolean;
    children: ReactNode;
}>) {
    const [isExpanded, setIsExpanded] = useStateSettingBoolean(
        toFoldSettingName(number, part),
        isExpandedByDefault,
    );
    return (
        <section className="d-flex flex-column gap-2" aria-label={title}>
            <button
                type="button"
                className={
                    'btn btn-sm btn-link p-0 text-reset text-decoration-none ' +
                    'd-flex align-items-center gap-1 small fw-semibold'
                }
                aria-expanded={isExpanded}
                onClick={() => {
                    setIsExpanded(!isExpanded);
                }}
            >
                <i
                    className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}
                    aria-hidden
                />
                <i className={`bi ${icon}`} aria-hidden />
                <span>{title}</span>
            </button>
            {isExpanded ? children : null}
        </section>
    );
}

function RenderStatusComp({
    display,
}: Readonly<{ display: VirtualDisplayInfo }>) {
    const watching = display.clients.filter((client) => !client.isPreview);
    if (display.stream === 'error') {
        return <span className="badge text-bg-danger">{tran('Stopped')}</span>;
    }
    // Watched in a browser or by a player: either way it is live.
    if (watching.length > 0 || display.stream === 'live') {
        return (
            <span className="badge text-bg-success">
                <i className="bi bi-broadcast me-1" aria-hidden />
                {`${tran('Live')} · ${watching.length}`}
            </span>
        );
    }
    if (display.stream === 'starting') {
        return (
            <span className="badge text-bg-success">{tran('Starting…')}</span>
        );
    }
    return <span className="badge text-bg-secondary">{tran('Idle')}</span>;
}

function RenderNameComp({ display, isBusy, perform }: PropsType) {
    const [name, setName] = useState(display.name);
    const commit = () => {
        const text = name.trim();
        if (!text || text === display.name) {
            setName(display.name);
            return;
        }
        void perform(() => {
            return virtualDisplayCommand('update', {
                number: display.number,
                name: text,
            });
        });
    };
    return (
        <label className="small d-flex flex-column gap-1">
            <span>{tran('Name')}</span>
            <input
                className="form-control form-control-sm"
                value={name}
                disabled={isBusy}
                maxLength={64}
                onChange={(event) => {
                    setName(event.target.value);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        commit();
                    }
                }}
            />
        </label>
    );
}

function RenderResolutionComp({ display, isBusy, perform }: PropsType) {
    const presetKey = `${display.width}x${display.height}`;
    const isPreset = RESOLUTION_PRESETS.some((preset) => {
        return `${preset.width}x${preset.height}` === presetKey;
    });
    const [isCustom, setIsCustom] = useState(!isPreset);
    const [width, setWidth] = useState(String(display.width));
    const [height, setHeight] = useState(String(display.height));
    const apply = (nextWidth: number, nextHeight: number) => {
        const size = clampResolution(nextWidth, nextHeight);
        setWidth(String(size.width));
        setHeight(String(size.height));
        if (size.width === display.width && size.height === display.height) {
            return;
        }
        void perform(() => {
            return virtualDisplayCommand('update', {
                number: display.number,
                ...size,
            });
        });
    };
    return (
        <div className="small d-flex flex-column gap-1">
            <label htmlFor={`app-vd-resolution-${display.number}`}>
                {tran('Resolution')}
            </label>
            <select
                id={`app-vd-resolution-${display.number}`}
                className="form-select form-select-sm"
                disabled={isBusy}
                value={isCustom ? 'custom' : presetKey}
                onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'custom') {
                        setIsCustom(true);
                        return;
                    }
                    setIsCustom(false);
                    const [w, h] = value.split('x').map(Number);
                    apply(w, h);
                }}
            >
                {RESOLUTION_PRESETS.map((preset) => {
                    const key = `${preset.width}x${preset.height}`;
                    return (
                        <option key={key} value={key}>
                            {preset.width} × {preset.height}
                        </option>
                    );
                })}
                <option value="custom">{tran('Custom')}</option>
            </select>
            {isCustom ? (
                <div className="input-group input-group-sm">
                    <span className="input-group-text">{tran('Width')}</span>
                    <input
                        className="form-control app-data"
                        type="number"
                        min={VIRTUAL_DISPLAY_MIN_SIDE}
                        max={VIRTUAL_DISPLAY_MAX_SIDE}
                        step={2}
                        value={width}
                        aria-label={tran('Width')}
                        onChange={(event) => {
                            setWidth(event.target.value);
                        }}
                    />
                    <span className="input-group-text">{tran('Height')}</span>
                    <input
                        className="form-control app-data"
                        type="number"
                        min={VIRTUAL_DISPLAY_MIN_SIDE}
                        max={VIRTUAL_DISPLAY_MAX_SIDE}
                        step={2}
                        value={height}
                        aria-label={tran('Height')}
                        onChange={(event) => {
                            setHeight(event.target.value);
                        }}
                    />
                    <button
                        type="button"
                        className="btn btn-outline-primary"
                        disabled={isBusy}
                        onClick={() => {
                            apply(Number(width), Number(height));
                        }}
                    >
                        {tran('Apply')}
                    </button>
                </div>
            ) : null}
            {display.clients.length > 0 ? (
                <span className="text-muted">
                    {tran(
                        'Changing the resolution restarts the stream for everyone watching.',
                    )}
                </span>
            ) : null}
        </div>
    );
}

function RenderWallpaperComp({ display, isBusy, perform }: PropsType) {
    const { wallpaper } = display;
    const [color, setColor] = useState(
        wallpaper.kind === 'color' ? wallpaper.color : '#000000',
    );
    // One write once the colour picker settles, not one per drag step.
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const save = (next: VirtualDisplayWallpaper) => {
        void perform(() => {
            return virtualDisplayCommand('update', {
                number: display.number,
                wallpaper: next,
            });
        });
    };
    const chooseFile = async (kind: 'image' | 'video') => {
        const filePaths = await selectFiles([
            {
                name: kind === 'image' ? tran('Image') : tran('Video'),
                extensions:
                    kind === 'image'
                        ? VIRTUAL_DISPLAY_IMAGE_EXTENSIONS
                        : VIRTUAL_DISPLAY_VIDEO_EXTENSIONS,
            },
        ]);
        if (filePaths.length > 0) {
            save({ kind, filePath: filePaths[0] });
        }
    };
    return (
        <div className="small d-flex flex-column gap-1">
            <label htmlFor={`app-vd-wallpaper-${display.number}`}>
                {tran('Wallpaper')}
            </label>
            <select
                id={`app-vd-wallpaper-${display.number}`}
                className="form-select form-select-sm"
                disabled={isBusy}
                value={wallpaper.kind}
                onChange={(event) => {
                    const kind = event.target.value;
                    if (kind === 'none') {
                        save({ kind: 'none' });
                    } else if (kind === 'color') {
                        save({ kind: 'color', color });
                    } else if (kind === 'image' || kind === 'video') {
                        void chooseFile(kind);
                    }
                }}
            >
                <option value="none">{tran('None (black)')}</option>
                <option value="color">{tran('Color')}</option>
                <option value="image">{tran('Image')}</option>
                <option value="video">{tran('Video')}</option>
            </select>
            {wallpaper.kind === 'color' ? (
                <input
                    type="color"
                    className="form-control form-control-sm form-control-color"
                    aria-label={tran('Color')}
                    value={color}
                    disabled={isBusy}
                    onChange={(event) => {
                        const value = event.target.value;
                        setColor(value);
                        attemptTimeout(() => {
                            save({ kind: 'color', color: value });
                        });
                    }}
                />
            ) : null}
            {wallpaper.kind === 'image' || wallpaper.kind === 'video' ? (
                <div className="d-flex align-items-center gap-1">
                    <span
                        className="app-data app-ellipsis flex-fill"
                        title={wallpaper.filePath}
                    >
                        {toBaseNameOfAnyOs(wallpaper.filePath)}
                    </span>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={isBusy}
                        onClick={() => {
                            void chooseFile(
                                wallpaper.kind as 'image' | 'video',
                            );
                        }}
                    >
                        <i className="bi bi-folder2-open me-1" aria-hidden />
                        {tran('Choose File')}
                    </button>
                </div>
            ) : null}
            {display.isWallpaperMissing ? (
                <span className="text-warning">
                    <i
                        className="bi bi-exclamation-triangle me-1"
                        aria-hidden
                    />
                    {tran('File not found')}
                </span>
            ) : null}
        </div>
    );
}

function toAddressGroupLabel(kind: VirtualDisplayAddress['kind']) {
    if (kind === 'this-computer') {
        return tran('This computer');
    }
    if (kind === 'lan') {
        return tran('This network');
    }
    // The public address with a port no router opened: forwarded by hand.
    if (kind === 'public') {
        return tran('Public IP');
    }
    if (kind === 'tunnel') {
        return tran('Tunnel');
    }
    return tran('Internet');
}

function RenderAddressRowComp({
    url,
    groupKind,
    isRecommended = false,
    isQrShowing,
    onToggleQr,
}: Readonly<{
    url: string;
    groupKind: VirtualDisplayAddress['kind'];
    isRecommended?: boolean;
    isQrShowing: boolean;
    onToggleQr: () => void;
}>) {
    return (
        <li className="d-flex flex-column">
            <div className="d-flex align-items-center gap-1">
                <span
                    className={`badge ${isRecommended ? 'text-bg-success' : 'text-bg-secondary'}`}
                    title={isRecommended ? tran('Recommended') : undefined}
                >
                    {isRecommended ? (
                        <i className="bi bi-star-fill me-1" aria-hidden />
                    ) : null}
                    {toAddressGroupLabel(groupKind)}
                </span>
                <span className="app-data text-break flex-grow-1">{url}</span>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={tran('Copy address')}
                    aria-label={`${tran('Copy address')}: ${url}`}
                    onClick={() => {
                        void copyToClipboard(url, tran('Copy address'));
                    }}
                >
                    <i className="bi bi-copy" aria-hidden />
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={tran('QR code')}
                    aria-label={`${tran('QR code')}: ${url}`}
                    aria-pressed={isQrShowing}
                    onClick={onToggleQr}
                >
                    <i className="bi bi-qr-code" aria-hidden />
                </button>
            </div>
            {isQrShowing ? <MirrorQrCodeComp text={url} /> : null}
        </li>
    );
}

// Where to watch: a browser draws the display itself (fastest, nothing is
// encoded here); a media player takes the MP4. What to give someone comes
// first, its QR code already open -- the best network of this computer and any
// internet address opened on purpose; every other card and the MP4 fold under
// "More addresses" (a laptop with a VPN and WSL listed five look-alikes).
function RenderAddressesComp({ display, state }: PropsType) {
    const { main, others } = useMemo(() => {
        return splitVirtualDisplayAddresses(state.addresses);
    }, [state.addresses]);
    const isSharing = main.some((address) => {
        return address.kind !== 'this-computer';
    });
    const [qrUrl, setQrUrl] = useState(() => {
        return isSharing && main.length > 0
            ? toVirtualDisplayPageUrl(main[0], display.number)
            : '';
    });
    const renderRows = (
        addresses: VirtualDisplayAddress[],
        toUrl: (address: VirtualDisplayAddress, number: number) => string,
        isRecommended = false,
    ) => {
        return (
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {addresses.map((address) => {
                    const url = toUrl(address, display.number);
                    return (
                        <RenderAddressRowComp
                            key={url}
                            url={url}
                            groupKind={address.kind}
                            isRecommended={
                                isRecommended &&
                                address.kind !== 'this-computer'
                            }
                            isQrShowing={qrUrl === url}
                            onToggleQr={() => {
                                setQrUrl(qrUrl === url ? '' : url);
                            }}
                        />
                    );
                })}
            </ul>
        );
    };
    return (
        <div className="small d-flex flex-column gap-1">
            <span>
                <i className="bi bi-browser-chrome me-1" aria-hidden />
                {tran('Watch in a browser')}
            </span>
            {renderRows(main, toVirtualDisplayPageUrl, true)}
            <RenderFoldComp
                number={display.number}
                part="more-addresses"
                title={tran('More addresses')}
                icon="bi-three-dots"
                isExpandedByDefault={false}
            >
                {others.length > 0
                    ? renderRows(others, toVirtualDisplayPageUrl)
                    : null}
                <span className="mt-1">
                    <i className="bi bi-film me-1" aria-hidden />
                    {tran('Video for media players (MP4)')}
                </span>
                {renderRows([...main, ...others], toVirtualDisplayStreamUrl)}
            </RenderFoldComp>
        </div>
    );
}

function RenderClientComp({
    display,
    client,
    isBusy,
    perform,
}: Readonly<{
    display: VirtualDisplayInfo;
    client: VirtualDisplayClient;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
}>) {
    const switchId = `app-vd-interactive-${client.id}`;
    const deviceLabel = client.isPreview
        ? ''
        : toViewerDeviceLabel(client.userAgent);
    return (
        <li className="d-flex flex-column gap-1">
            <div className="d-flex align-items-center gap-1">
                <span className="badge text-bg-info">
                    {client.kind === 'web' ? tran('Browser') : 'MP4'}
                </span>
                <span className="badge text-bg-secondary">
                    {client.network === 'internet' ? (
                        <i className="bi bi-globe2 me-1" aria-hidden />
                    ) : null}
                    {toAddressGroupLabel(
                        client.network === 'local'
                            ? 'lan'
                            : client.network === 'internet'
                              ? 'internet'
                              : 'this-computer',
                    )}
                </span>
                <span
                    className="app-data app-ellipsis flex-fill"
                    title={client.userAgent}
                >
                    {client.isPreview
                        ? tran('This app (preview)')
                        : client.address}
                    {deviceLabel ? (
                        <span className="text-muted">{` · ${deviceLabel}`}</span>
                    ) : null}
                </span>
                <span className="text-muted text-nowrap">
                    {new Date(client.since).toLocaleTimeString()}
                </span>
            </div>
            {client.camera !== undefined ? (
                <span
                    className="badge text-bg-success align-self-start app-ellipsis"
                    title={client.camera}
                >
                    <i className="bi bi-camera-video-fill me-1" aria-hidden />
                    {client.camera}
                </span>
            ) : null}
            {client.waiting !== null ? (
                <span className="badge text-bg-warning align-self-start">
                    {client.waiting === 'approval'
                        ? tran('Waiting for approval')
                        : tran('Waiting for the code')}
                </span>
            ) : null}
            <div className="d-flex align-items-center gap-2">
                {/* From the internet, nothing of the display is sent until
                    the operator allows it (or it gives the code). */}
                {client.waiting === 'approval' ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={isBusy}
                        onClick={() => {
                            void perform(() => {
                                return virtualDisplayCommand('allow', {
                                    number: display.number,
                                    clientId: client.id,
                                });
                            });
                        }}
                    >
                        {tran('Allow connection')}
                    </button>
                ) : null}
                {/* A media player cannot answer: this computer's microphone
                    goes into the display's MP4 sound -- one stream, so one
                    switch for every player of it. */}
                {client.kind === 'video' && !client.isPreview ? (
                    <MirrorIntercomComp
                        intercom={{
                            mic: display.isMp4MicOn,
                            speaker: false,
                            volume: 1,
                            remoteMic: false,
                        }}
                        busy={isBusy}
                        isSpeakerShown={false}
                        onChange={(change) => {
                            return perform(() => {
                                return virtualDisplayCommand('mp4-mic', {
                                    number: display.number,
                                    enabled: change.mic === true,
                                });
                            });
                        }}
                    />
                ) : null}
                {/* Talk-back with a browser that was let in: this
                    computer's microphone to it, its microphone here. */}
                {client.intercom !== undefined ? (
                    <MirrorIntercomComp
                        intercom={client.intercom}
                        busy={isBusy}
                        onChange={(change) => {
                            return perform(() => {
                                return mirrorCommand('intercom', {
                                    key: `viewer:${client.id}`,
                                    ...change,
                                });
                            });
                        }}
                    />
                ) : null}
                {/* A browser draws the screens itself, so a hand on it can
                    scroll and pick verses -- in the app too, once allowed. */}
                {client.kind === 'web' && client.waiting === null ? (
                    <div
                        className="form-check form-switch mb-0"
                        title={tran(
                            'Lets this viewer scroll and pick verses in the app',
                        )}
                    >
                        <input
                            id={switchId}
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={client.isInteractive}
                            disabled={isBusy}
                            onChange={(event) => {
                                const enabled = event.target.checked;
                                void perform(() => {
                                    return virtualDisplayCommand(
                                        'interactive',
                                        {
                                            number: display.number,
                                            clientId: client.id,
                                            enabled,
                                        },
                                    );
                                });
                            }}
                        />
                        <label className="form-check-label" htmlFor={switchId}>
                            {tran('Allow interaction')}
                        </label>
                    </div>
                ) : null}
                {client.isPreview ? null : (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger ms-auto"
                        disabled={isBusy}
                        onClick={() => {
                            void perform(() => {
                                return virtualDisplayCommand('disconnect', {
                                    number: display.number,
                                    clientId: client.id,
                                });
                            });
                        }}
                    >
                        {client.waiting === null
                            ? tran('Disconnect')
                            : tran('Reject connection')}
                    </button>
                )}
            </div>
        </li>
    );
}

function RenderStreamComp({ display, isBusy, perform }: PropsType) {
    const isAac =
        display.mimeType === null || display.mimeType.includes('mp4a');
    return (
        <div className="small d-flex flex-column gap-1">
            {display.stream === 'error' && display.error ? (
                <span className="text-danger" role="alert">
                    {toVirtualDisplayErrorText(display.error)}
                </span>
            ) : null}
            {isAac ? null : (
                <span className="text-warning">
                    {tran(
                        'This computer cannot encode AAC audio, so the video has no sound.',
                    )}
                </span>
            )}
            <span>{tran('Watching now')}</span>
            {display.clients.length === 0 ? (
                <span className="text-muted">{tran('No one is watching')}</span>
            ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                    {display.clients.map((client) => {
                        return (
                            <RenderClientComp
                                key={client.id}
                                display={display}
                                client={client}
                                isBusy={isBusy}
                                perform={perform}
                            />
                        );
                    })}
                </ul>
            )}
            {display.blocked.length > 0 ? (
                <RenderBlockedComp
                    display={display}
                    isBusy={isBusy}
                    perform={perform}
                />
            ) : null}
        </div>
    );
}

// Viewers the operator disconnected, kept out for ten minutes unless let back
// in here: a browser by itself, a media player by its address.
function RenderBlockedComp({
    display,
    isBusy,
    perform,
}: Readonly<{
    display: VirtualDisplayInfo;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
}>) {
    return (
        <>
            <span className="mt-1">{tran('Disconnected')}</span>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {display.blocked.map((entry) => {
                    return (
                        <li
                            key={entry.key}
                            className="d-flex align-items-center gap-1"
                        >
                            <span className="badge text-bg-secondary">
                                {entry.kind === 'web' ? tran('Browser') : 'MP4'}
                            </span>
                            <span className="app-data app-ellipsis flex-fill text-muted">
                                {entry.address}
                            </span>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={isBusy}
                                onClick={() => {
                                    void perform(() => {
                                        return virtualDisplayCommand(
                                            'unblock',
                                            {
                                                number: display.number,
                                                key: entry.key,
                                            },
                                        );
                                    });
                                }}
                            >
                                {tran('Allow again')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// One virtual display: its settings, where to watch it, who is watching, and
// what it shows right now.
export default function VirtualDisplayCardComp(
    props: PropsType &
        Readonly<{
            isJustCreated: boolean;
        }>,
) {
    const { display, state, isJustCreated, isBusy, perform } = props;
    const [isExpanded, setIsExpanded] = useStateSettingBoolean(
        toFoldSettingName(display.number, 'card'),
        false,
    );
    // A display just added opens, ready to be named.
    useAppEffect(() => {
        if (isJustCreated) {
            setIsExpanded(true);
        }
    }, [isJustCreated]);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCastOpen, setIsCastOpen] = useState(false);
    const confirmDelete = async () => {
        const isOk = await showAppConfirm(
            tran('Delete Virtual Display'),
            tran(
                'Screens showing on this virtual display will be hidden, and everyone watching it will be disconnected.',
            ),
        );
        if (isOk) {
            await perform(async () => {
                await virtualDisplayCommand('delete', {
                    number: display.number,
                });
                clearFoldSettings(display.number);
            });
        }
    };
    return (
        <div className="card">
            <div className="card-header d-flex align-items-center gap-2 p-1">
                <button
                    type="button"
                    className="btn btn-sm btn-link p-0"
                    aria-expanded={isExpanded}
                    aria-label={`${display.name}: ${display.width} × ${display.height}`}
                    onClick={() => {
                        setIsExpanded(!isExpanded);
                    }}
                >
                    <i
                        className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}
                        aria-hidden
                    />
                </button>
                <i className="bi bi-display" aria-hidden />
                <span className="app-ellipsis flex-fill" title={display.name}>
                    {display.name}
                </span>
                <VirtualDisplayCastButtonComp
                    display={display}
                    isOpen={isCastOpen}
                    onToggle={() => {
                        setIsCastOpen(!isCastOpen);
                    }}
                />
                <span className="small text-muted app-data">
                    {display.width}×{display.height}
                </span>
                <RenderStatusComp display={display} />
            </div>
            {isCastOpen ? (
                <VirtualDisplayCastComp
                    {...props}
                    onClose={() => {
                        setIsCastOpen(false);
                    }}
                />
            ) : null}
            {isExpanded ? (
                <div className="card-body p-2 d-flex flex-column gap-2">
                    {/* First, so it opens where it was pressed: under Delete it
                        needed a scroll to find. */}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary align-self-start"
                        aria-pressed={isPreviewing}
                        onClick={() => {
                            setIsPreviewing(!isPreviewing);
                        }}
                    >
                        <i
                            className={`bi bi-${isPreviewing ? 'eye-slash' : 'eye'} me-1`}
                            aria-hidden
                        />
                        {tran('Preview')}
                    </button>
                    {isPreviewing ? (
                        <AppSuspenseComp>
                            <LazyPreviewComp
                                port={state.port}
                                number={display.number}
                                width={display.width}
                                height={display.height}
                            />
                        </AppSuspenseComp>
                    ) : null}
                    {/* Like windows on a real monitor, the screen shown last
                        covers the others wherever it has a background. */}
                    {display.screenIds.length > 1 ? (
                        <span className="small text-warning">
                            <i className="bi bi-layers me-1" aria-hidden />
                            {tran(
                                'Several screens show on this display, stacked: the one shown last is on top.',
                            )}{' '}
                            <span className="app-data">
                                {display.screenIds.join(', ')}
                            </span>
                        </span>
                    ) : null}
                    <RenderFoldComp
                        number={display.number}
                        part="settings"
                        title={tran('Settings')}
                        icon="bi-sliders"
                    >
                        <RenderNameComp {...props} />
                        <RenderResolutionComp {...props} />
                        <RenderWallpaperComp {...props} />
                        {display.screenIds.length > 0 ? (
                            <span className="small">
                                {tran('Screens on this display')}:{' '}
                                <span className="app-data">
                                    {display.screenIds.join(', ')}
                                </span>
                            </span>
                        ) : null}
                    </RenderFoldComp>
                    <RenderFoldComp
                        number={display.number}
                        part="addresses"
                        title={tran('Where to watch')}
                        icon="bi-link-45deg"
                    >
                        <RenderAddressesComp {...props} />
                    </RenderFoldComp>
                    <RenderStreamComp {...props} />
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger align-self-end"
                        disabled={isBusy}
                        onClick={() => {
                            void confirmDelete();
                        }}
                    >
                        <i className="bi bi-trash me-1" aria-hidden />
                        {tran('Delete Virtual Display')}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
