import TimerClockController, {
    type TimerClockTimingType,
} from './TimerClockController';
import {
    toStopwatchElapsedMillisecond,
    toStopwatchMillisecondToNextChange,
} from './timerStateHelpers';

/** Counts up from zero; see `TimerClockController` for start / pause. */
export default class StopwatchController extends TimerClockController {
    get elapsedMillisecond() {
        return toStopwatchElapsedMillisecond(this.timing);
    }

    get shownSecond() {
        return Math.floor(this.elapsedMillisecond / 1000);
    }

    get millisecondToNextChange() {
        return toStopwatchMillisecondToNextChange(this.elapsedMillisecond);
    }

    protected setExtraHtml() {
        // Nothing beyond the digits.
    }

    static init(
        divContainer: HTMLDivElement,
        timing: TimerClockTimingType | Date,
    ) {
        return new this(divContainer, timing);
    }
}
