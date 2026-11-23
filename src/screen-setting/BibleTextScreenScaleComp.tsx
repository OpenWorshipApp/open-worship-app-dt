import './BibleTextScreenScaleComp.scss';

import { type CSSProperties, useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { genThrottleAttempt } from '../helper/timeoutHelpers';
import AppRangeComp from '../others/AppRangeComp';
import PropRowComp from '../presenter-foreground/ForegroundPropRowComp';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import type ScreenManagerBase from '../_screen/managers/ScreenManagerBase';
import { getAllScreenManagerBases } from '../_screen/managers/screenManagerBaseHelpers';
import { useScreenManagerEvents } from '../_screen/managers/screenManagerHooks';
import { useScreenLongTextManagerEvents } from '../_screen/managers/screenEventHelpers';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';
import {
    DEFAULT_SCREEN_TEXT_SCALE,
    MAX_SCREEN_TEXT_SCALE,
    MIN_SCREEN_TEXT_SCALE,
} from '../_screen/screenTextScaleHelpers';

// Not `screen-…` or `bible-style…`: those are presentation settings, sent to
// every showing screen on each write, and this one is only the panel's.
export const BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME =
    'bible-custom-style-screen-scale-opened';

// Module-level, as the panel's other ranges: `AppRangeComp` re-runs an effect
// on a new `defaultSize` object.
const SCREEN_SCALE_RANGE = {
    size: 0,
    min: MIN_SCREEN_TEXT_SCALE,
    max: MAX_SCREEN_TEXT_SCALE,
    step: 0.05,
};
// The same window as the shared look's (`useBibleTextStyleEditing`): each
// change is a setting file written and a message to a screen.
const COMMIT_WINDOW_MILLISECOND = 80;

// Every screen that draws Bible / Long Text, in screen-id order.
function getScreenLongTextManagers() {
    return getAllScreenManagerBases()
        .map((screenManagerBase) => {
            return ScreenLongTextManager.getInstance(
                screenManagerBase.screenId,
            );
        })
        .filter((screenLongTextManager) => {
            return screenLongTextManager !== null;
        }) as ScreenLongTextManager[];
}

function checkIsAnyScreenScaled() {
    return getScreenLongTextManagers().some((screenLongTextManager) => {
        return screenLongTextManager.textScale !== DEFAULT_SCREEN_TEXT_SCALE;
    });
}

function genDisplaySizeTitle(screenManagerBase: ScreenManagerBase) {
    const { width, height } = screenManagerBase.display.bounds;
    return `${width}×${height}`;
}

/**
 * One screen's scale. The row draws from a copy changed the moment the
 * slider moves, while the change itself goes out behind it -- drawn from the
 * setting, a dragged thumb jumped back to the last value that went out.
 */
function ScreenScaleRowComp({
    screenLongTextManager,
}: Readonly<{ screenLongTextManager: ScreenLongTextManager }>) {
    const { screenId, screenManagerBase } = screenLongTextManager;
    const [scale, setScale] = useState(() => {
        return screenLongTextManager.textScale;
    });
    useScreenLongTextManagerEvents(
        ['text-scale'],
        screenLongTextManager,
        () => {
            setScale(screenLongTextManager.textScale);
        },
    );
    // Per row: a shared one would let one screen's change swallow another's.
    const attemptCommit = useMemo(() => {
        return genThrottleAttempt(COMMIT_WINDOW_MILLISECOND);
    }, []);
    const applyScale = (newScale: number) => {
        setScale(newScale);
        attemptCommit(() => {
            screenLongTextManager.textScale = newScale;
        });
    };
    const label = `${tran('Screen')}: ${screenId}`;
    const resetLabel = `${tran('Default')}: ${label}`;
    const isDefault = scale === DEFAULT_SCREEN_TEXT_SCALE;
    return (
        <div
            className="bible-style-screen-scale-row"
            style={
                {
                    '--screen-id-color': genColorFromScreenId(screenId),
                } as CSSProperties
            }
        >
            <PropRowComp
                iconClassName="bi bi-display"
                label={label}
                isEngaged={!isDefault}
                title={genDisplaySizeTitle(screenManagerBase)}
            >
                <AppRangeComp
                    value={scale}
                    title={label}
                    setValue={applyScale}
                    defaultSize={SCREEN_SCALE_RANGE}
                    isShowValue
                    isCompact
                />
                <span className="fg-unit-static">×</span>
                <button
                    type="button"
                    className="bible-style-highlight-reset"
                    title={resetLabel}
                    aria-label={resetLabel}
                    disabled={isDefault}
                    onClick={() => {
                        applyScale(DEFAULT_SCREEN_TEXT_SCALE);
                    }}
                >
                    <i
                        className="bi bi-arrow-counterclockwise"
                        aria-hidden="true"
                    />
                </button>
            </PropRowComp>
        </div>
    );
}

function ScreenScaleListComp() {
    useScreenManagerEvents(['instance']);
    return (
        <>
            {getScreenLongTextManagers().map((screenLongTextManager) => {
                return (
                    <ScreenScaleRowComp
                        key={screenLongTextManager.screenId}
                        screenLongTextManager={screenLongTextManager}
                    />
                );
            })}
        </>
    );
}

/**
 * Screen Scale: how much bigger or smaller each screen draws the size set
 * above (2026-11-19, the user: _when I have screen scale factor I would change
 * the size per screen so I can apply it differently_), 1 for every screen
 * until changed. Folded unless opened, and remembered: it is set once per
 * room, not per service. The rows are mounted only while it is open.
 */
export default function BibleTextScreenScaleComp() {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME,
        false,
    );
    // For the dot on the fold: a scale changed anywhere, or a screen added or
    // deleted, may change whether any screen is scaled.
    const [isAnyScaled, setIsAnyScaled] = useState(checkIsAnyScreenScaled);
    const refreshIsAnyScaled = () => {
        setIsAnyScaled(checkIsAnyScreenScaled());
    };
    useScreenLongTextManagerEvents(
        ['text-scale'],
        undefined,
        refreshIsAnyScaled,
    );
    useScreenManagerEvents(['instance'], undefined, refreshIsAnyScaled);
    const name = tran('Screen Scale');
    const foldLabel = `${isOpened ? tran('Collapse') : tran('Expand')}: ${name}`;
    return (
        <section
            className="bible-style-rows bible-style-screen-scale"
            aria-label={name}
        >
            <button
                type="button"
                className="bible-style-section-title bible-style-screen-scale-fold"
                aria-expanded={isOpened}
                title={foldLabel}
                onClick={() => {
                    setIsOpened(!isOpened);
                }}
            >
                <i
                    className={`bi bi-chevron-${isOpened ? 'down' : 'right'}`}
                    aria-hidden="true"
                />
                <i className="bi bi-aspect-ratio" aria-hidden="true" />
                <span>{name}</span>
                {isAnyScaled ? (
                    <span className="fg-deco-dot" aria-hidden="true" />
                ) : null}
            </button>
            {isOpened ? <ScreenScaleListComp /> : null}
        </section>
    );
}
