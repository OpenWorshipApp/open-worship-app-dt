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
    }

    static init(
        divContainer: HTMLDivElement,
        timing: CountdownTimingType | Date,
    ) {
        return new this(divContainer, timing);
    }
}
