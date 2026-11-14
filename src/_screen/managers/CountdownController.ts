import { setClockDataset, setClockText } from './clockTextHelpers';
import TimerClockController, {
    type TimerClockTimingType,
} from './TimerClockController';
import {
    toCountdownMillisecondToNextChange,
    toCountdownRemainingMillisecond,
    toCountdownShownSecond,
} from './timerStateHelpers';

type CountdownTimingType = TimerClockTimingType & {
    durationMillisecond?: number;
};

const SECOND_A_DAY = 24 * 3600;

/**
 * How a number of days is written in front of the hours: `41d`, `41j`.
 * Handed in by whoever builds the widget, so this controller stays free of
 * the language module (and the app hooks and settings it loads) -- English's
 * own form when nothing is given.
 */
export type CountdownDayTextType = (days: number) => string;

function toEnglishDayText(days: number) {
    return `${days}d`;
}

/**
 * Counts down, and once the time is up counts UP: the digits then read how
 * far over it is, behind a `+`, so a speaker can see by how much they ran on.
 * The box's `data-time-diff` stays at "0" for the whole overtime, which is
 * what lets the "time is up" flash run its five times once and then rest red
 * rather than restart.
 */
export default class CountdownController extends TimerClockController<CountdownTimingType> {
    /** What it reads now, in milliseconds; negative once it is over. */
    get remainingMillisecond() {
        return toCountdownRemainingMillisecond(this.timing);
    }

    /** What is left, never below zero. */
    get timeDiff() {
        return Math.max(0, this.remainingMillisecond);
    }

    get isOver() {
        return this.remainingMillisecond <= 0;
    }

    get shownSecond() {
        return toCountdownShownSecond(this.remainingMillisecond).second;
    }

    get millisecondToNextChange() {
        return toCountdownMillisecondToNextChange(this.remainingMillisecond);
    }

    /**
     * Whole days, shown in front of the hours from one full day out
     * (2026-11-13, the user's choice): 42 days had read ⏳ 1001:54:52 on the
     * wall. The stopwatch keeps its hours: nothing it times runs for days.
     */
    get days() {
        return Math.floor(this.shownSecond / SECOND_A_DAY);
    }

    /** The hours of the last day while days show, every hour otherwise. */
    get hourStr() {
        const hours = this.days > 0 ? this.hours % 24 : this.hours;
        return hours.toString().padStart(2, '0');
    }

    get divDay() {
        return this.divContainer.querySelector('#day') as HTMLElement | null;
    }

    private dayTextCache: { days: number; text: string } | null = null;

    /** Set by `init` before the first tick; English until then. */
    toDayText: CountdownDayTextType = toEnglishDayText;

    /**
     * `41d`, `41j` -- the app's own words, read again only when the
     * day changes, never on every tick.
     */
    get dayText() {
        const days = this.days;
        if (this.dayTextCache?.days !== days) {
            // The base constructor draws before this class's fields are set.
            const toDayText = this.toDayText ?? toEnglishDayText;
            this.dayTextCache = { days, text: toDayText(days) };
        }
        return this.dayTextCache.text;
    }

    get divSign() {
        return this.divContainer.querySelector('#sign') as HTMLElement | null;
    }

    get divBox() {
        return this.divContainer.querySelector(
            '.foreground-countdown-container > div',
        ) as HTMLDivElement;
    }

    protected setExtraHtml(isReset: boolean) {
        // Whole seconds, not milliseconds: the only reader is the CSS rule for
        // "0" (the alert), and a millisecond value rewrote the attribute -- and
        // re-ran that selector -- on every tick.
        setClockDataset(
            this.divBox,
            'timeDiff',
            isReset ? '' : Math.ceil(this.timeDiff / 1000).toString(),
        );
        setClockText(
            this.divSign,
            !isReset && this.isOver && this.shownSecond > 0 ? '+' : '',
        );
        setClockText(
            this.divDay,
            !isReset && this.days > 0 ? this.dayText : '',
        );
    }

    static init(
        divContainer: HTMLDivElement,
        timing: CountdownTimingType | Date,
        toDayText?: CountdownDayTextType,
    ) {
        const controller = new this(divContainer, timing);
        if (toDayText !== undefined) {
            controller.toDayText = toDayText;
            controller.dayTextCache = null;
            controller.setHtml(false);
        }
        return controller;
    }
}
