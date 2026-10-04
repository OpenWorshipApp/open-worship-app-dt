import { setClockText } from './clockTextHelpers';
import { checkIsTimerStopped } from './timerStateHelpers';

// A tick lands this long AFTER the moment the shown second changes, so it never
// reads the clock a hair before the boundary and writes the same digits again.
const TICK_MARGIN_MILLISECOND = 20;

export type TimerClockTimingType = {
    dateTime: Date;
    pausedMillisecond?: number;
};

/**
 * What the countdown and the stopwatch share on the screen: three digit groups
 * drawn from the clock's DATUM timing, and a tick that runs only while it is
 * running.
 *
 * It ticks once a second, ON the second -- never on every animation frame. A
 * countdown counts the time over and a stopwatch counts for as long as it is
 * up, often the rest of the service, in the screen window and in every mini
 * preview; sixty wake-ups a second to change one digit is a cost the machines
 * this app runs on cannot spare. Stopped (shown but not started, or paused),
 * it does not tick at all.
 */
export default abstract class TimerClockController<
    TimingType extends TimerClockTimingType = TimerClockTimingType,
> {
    readonly divContainer: HTMLDivElement;
    timing: TimingType;
    /** False once the widget is taken down; nothing ticks after that. */
    isAlive = true;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(divContainer: HTMLDivElement, timing: TimingType | Date) {
        this.divContainer = divContainer;
        this.timing =
            timing instanceof Date
                ? ({ dateTime: timing } as TimingType)
                : timing;
        // Subclasses keep no state of their own -- what they draw is read off
        // `timing` and the container -- so drawing from here is safe.
        this.setHtml(false);
    }

    /** The whole seconds the digits show. */
    abstract get shownSecond(): number;

    /** How long until a RUNNING clock's digits next read differently. */
    abstract get millisecondToNextChange(): number;

    /** Anything beyond the digits a clock writes (a sign, a data attribute). */
    protected abstract setExtraHtml(isReset: boolean): void;

    get isStopped() {
        return checkIsTimerStopped(this.timing);
    }

    /** An unreadable `dateTime` on a running clock shows zeros and never ticks. */
    get isValid() {
        return (
            this.isStopped ||
            (this.timing.dateTime instanceof Date &&
                Number.isFinite(this.timing.dateTime.getTime()))
        );
    }

    get hours() {
        return Math.floor(this.shownSecond / 3600) % 24;
    }

    get minutes() {
        return Math.floor((this.shownSecond % 3600) / 60);
    }

    get seconds() {
        return this.shownSecond % 60;
    }

    getDivChild(divId: string) {
        return this.divContainer.querySelector(`#${divId}`) as HTMLDivElement;
    }

    get divHour() {
        return this.getDivChild('hour');
    }

    get divMinute() {
        return this.getDivChild('minute');
    }

    get divSecond() {
        return this.getDivChild('second');
    }

    toTimeString(n: number) {
        return ('0' + n.toString()).slice(-2);
    }

    get hourStr() {
        return this.toTimeString(this.hours);
    }

    get minuteStr() {
        return this.toTimeString(this.minutes);
    }

    get secondStr() {
        return this.toTimeString(this.seconds);
    }

    start() {
        this.tick();
    }

    /** A start, pause, resume or reset, applied to the clock already up. */
    update(timing: TimingType) {
        this.timing = timing;
        this.tick();
    }

    private tick() {
        this.clearTick();
        if (!this.isAlive) {
            return;
        }
        this.setHtml(false);
        if (!this.isValid || this.isStopped) {
            return;
        }
        this.timeoutId = setTimeout(() => {
            this.timeoutId = null;
            this.tick();
        }, this.millisecondToNextChange + TICK_MARGIN_MILLISECOND);
    }

    setHtml(isResetting: boolean) {
        const isReset = isResetting || !this.isValid;
        this.setExtraHtml(isReset);
        setClockText(this.divHour, isReset ? '00' : this.hourStr);
        setClockText(this.divMinute, isReset ? '00' : this.minuteStr);
        setClockText(this.divSecond, isReset ? '00' : this.secondStr);
    }

    private clearTick() {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    /** The widget is coming down: stop ticking for good. */
    dispose() {
        this.isAlive = false;
        this.clearTick();
    }

    stop() {
        this.dispose();
        this.setHtml(true);
    }
}
