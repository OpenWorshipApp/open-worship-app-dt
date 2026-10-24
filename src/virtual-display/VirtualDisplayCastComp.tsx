import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import type { CastTargetKind } from '../../electron/castProtocol';
import type { CastFailureType } from '../../electron/castTargets';
import type {
    VirtualDisplayCast,
    VirtualDisplayInfo,
    VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';
import { virtualDisplayCommand } from './virtualDisplayHelpers';
import type { VirtualDisplayPerformType } from './VirtualDisplaysComp';

// Names of the kinds of TV, the makers' own -- not translated.
const KIND_NAMES: Record<CastTargetKind, string> = {
    'google-cast': 'Google Cast',
    dlna: 'DLNA',
    roku: 'Roku',
};

// The cast symbol people know from their phones (Material Icons' "cast",
// Apache-2.0): a screen with a signal in its corner.
export const CAST_ICON_PATH =
    'M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z';

function CastIconComp() {
    return (
        <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            style={{ verticalAlign: '-0.125em' }}
        >
            <path d={CAST_ICON_PATH} />
        </svg>
    );
}

function toFailureText(failure: CastFailureType | null) {
    if (failure === 'unreachable') {
        return tran('The TV could not be reached.');
    }
    if (failure === 'timeout') {
        return tran('The TV did not answer.');
    }
    if (failure === 'ended') {
        return tran('The TV stopped playing.');
    }
    return tran('The TV could not play this display.');
}

function toStatusText(cast: VirtualDisplayCast) {
    if (cast.status === 'connecting') {
        return tran('Connecting');
    }
    if (cast.status === 'casting') {
        const word =
            cast.playbackRate > 1 ? tran('Catching up') : tran('Casting');
        return cast.behind === null
            ? word
            : `${word} · ${cast.behind.toFixed(1)} s ${tran('behind live')}`;
    }
    return toFailureText(cast.failure);
}

// The cast button in a display's header: lit while a TV plays it.
export function VirtualDisplayCastButtonComp({
    display,
    isOpen,
    onToggle,
}: Readonly<{
    display: VirtualDisplayInfo;
    isOpen: boolean;
    onToggle: () => void;
}>) {
    const isCasting = display.casts.some((cast) => {
        return cast.status === 'casting';
    });
    return (
        <button
            type="button"
            className={`btn btn-sm py-0 px-1 ${
                isCasting ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            title={tran('Cast to a TV')}
            aria-label={tran('Cast to a TV')}
            aria-expanded={isOpen}
            onClick={onToggle}
        >
            <CastIconComp />
        </button>
    );
}

// The TVs on this network, and the ones this display is cast to. Opening it
// is what looks for them: nothing is searched for until then.
export default function VirtualDisplayCastComp({
    display,
    state,
    isBusy,
    perform,
    onClose,
}: Readonly<{
    display: VirtualDisplayInfo;
    state: VirtualDisplayState;
    isBusy: boolean;
    perform: VirtualDisplayPerformType;
    onClose: () => void;
}>) {
    const search = () => {
        // Not through `perform`: the search takes a few seconds, and the rest
        // of the panel stays usable meanwhile.
        void virtualDisplayCommand('cast-search', {}).catch(() => {});
    };
    useAppEffect(() => {
        search();
    }, []);
    const castIds = new Set(display.casts.map((cast) => cast.id));
    const targets = state.castTargets.filter((target) => {
        return !castIds.has(target.id);
    });
    const isEmpty =
        !state.isCastSearching &&
        targets.length === 0 &&
        display.casts.length === 0;
    return (
        <section
            className="border-bottom p-2 d-flex flex-column gap-2"
            aria-label={tran('Cast to a TV')}
        >
            <div className="d-flex align-items-center gap-2">
                <CastIconComp />
                <strong className="flex-fill">{tran('Cast to a TV')}</strong>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={state.isCastSearching}
                    onClick={search}
                >
                    {state.isCastSearching ? (
                        <>
                            <span
                                className="spinner-border spinner-border-sm me-1"
                                aria-hidden
                            />
                            {tran('Looking for TVs…')}
                        </>
                    ) : (
                        <>
                            <i
                                className="bi bi-arrow-clockwise me-1"
                                aria-hidden
                            />
                            {tran('Search again')}
                        </>
                    )}
                </button>
                <button
                    type="button"
                    className="btn-close"
                    aria-label={tran('Close')}
                    onClick={onClose}
                />
            </div>
            {state.shareEnabled ? null : (
                <p className="small text-muted mb-0">
                    {tran('Turn on “Let other devices watch” to cast to a TV.')}
                </p>
            )}
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {display.casts.map((cast) => {
                    return (
                        <li key={cast.id} className="d-flex flex-column">
                            <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-tv" aria-hidden />
                                <span
                                    className="app-ellipsis flex-fill"
                                    title={cast.name}
                                >
                                    {cast.name}
                                </span>
                                <span className="badge text-bg-secondary">
                                    {KIND_NAMES[cast.kind]}
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={isBusy}
                                    onClick={() => {
                                        void perform(() => {
                                            return virtualDisplayCommand(
                                                'cast-stop',
                                                {
                                                    number: display.number,
                                                    targetId: cast.id,
                                                },
                                            );
                                        });
                                    }}
                                >
                                    {tran('Stop')}
                                </button>
                            </div>
                            {/* Under the TV's name, so the row keeps its
                                name whole: beside it, "Casting · 1.9 s
                                behind live" squeezed the name to a few
                                letters. */}
                            <span
                                className={`small ps-4 ${
                                    cast.status === 'failed'
                                        ? 'text-danger'
                                        : 'text-success'
                                }`}
                                role={
                                    cast.status === 'failed'
                                        ? 'alert'
                                        : undefined
                                }
                            >
                                {toStatusText(cast)}
                            </span>
                        </li>
                    );
                })}
                {targets.map((target) => {
                    return (
                        <li
                            key={target.id}
                            className="d-flex align-items-center gap-2"
                        >
                            <i className="bi bi-tv" aria-hidden />
                            <span
                                className="app-ellipsis flex-fill"
                                title={target.name}
                            >
                                {target.name}
                            </span>
                            <span className="badge text-bg-secondary">
                                {KIND_NAMES[target.kind]}
                            </span>
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={isBusy || !state.shareEnabled}
                                onClick={() => {
                                    void perform(() => {
                                        return virtualDisplayCommand(
                                            'cast-start',
                                            {
                                                number: display.number,
                                                targetId: target.id,
                                            },
                                        );
                                    });
                                }}
                            >
                                <span className="me-1">
                                    <CastIconComp />
                                </span>
                                {tran('Cast')}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {isEmpty ? (
                <p className="small text-muted mb-0">
                    {tran(
                        'No TV found. Make sure the TV is on and on the same network as this computer.',
                    )}
                </p>
            ) : null}
        </section>
    );
}
