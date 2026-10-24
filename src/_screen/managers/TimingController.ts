import { setClockText } from './clockTextHelpers';

export type ClockPeriodType = 'AM' | 'PM';

// A tick lands this long AFTER the second changes, so it never reads the clock
// a hair before the boundary and writes the same digits again.
const TICK_MARGIN_MILLISECOND = 20;

/**
 * A clock on the screen: the time of day in one timezone.
 *
 * It ticks once a second, ON the second -- it used to redraw on every
 * animation frame, sixty wake-ups a second for one digit, in the screen window
 * and in every mini preview, for as long as a clock stayed up.
 */
export default class TimingController {
    readonly divContainer: HTMLDivElement;
    readonly timezoneMinuteOffset: number;
    readonly is24HourFormat: boolean;
    /** Words for AM and PM in the app's language; English when not given. */
    readonly toPeriodText: (period: ClockPeriodType) => string;
    isRunning = true;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(
        divContainer: HTMLDivElement,
        timezoneMinuteOffset: number,
        is24HourFormat = false,
        toPeriodText: (period: ClockPeriodType) => string = (period) => {
            return period;
        },
    ) {
        this.divContainer = divContainer;
        this.timezoneMinuteOffset = timezoneMinuteOffset;
        this.is24HourFormat = is24HourFormat;
        this.toPeriodText = toPeriodText;
        this.setHtml(false);
    }

    get date() {
        const date = new Date();
        const utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
        const localDate = new Date(
            utcTime + this.timezoneMinuteOffset * 60 * 60 * 1000,
        );
        return localDate;
    }

    get hours() {
        return this.date.getHours();
    }

    get minutes() {
        return this.date.getMinutes();
    }

    get seconds() {
        return this.date.getSeconds();
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

    get divAmPm() {
        return this.divContainer.querySelector(
            '#ampm',
        ) as HTMLDivElement | null;
    }

    toTimeString(n: number) {
        return ('0' + n.toString()).slice(-2);
    }

    get hourStr() {
        if (this.is24HourFormat) {
            return this.toTimeString(this.hours);
        }
        return this.toTimeString(this.hours % 12 || 12);
    }

    /** In the app's language: a Khmer congregation used to read a Latin `PM`. */
    get periodStr() {
        return this.toPeriodText(this.hours >= 12 ? 'PM' : 'AM');
    }

    get minuteStr() {
        return this.toTimeString(this.minutes);
    }

    get secondStr() {
        return this.toTimeString(this.seconds);
    }

    start() {
        this.isRunning = true;
        this.tick();
    }

    private tick() {
        this.clearTick();
        if (!this.isRunning) {
            return;
        }
        this.setHtml(false);
        const millisecondToNextSecond = 1000 - (Date.now() % 1000);
        this.timeoutId = setTimeout(() => {
            this.timeoutId = null;
            this.tick();
        }, millisecondToNextSecond + TICK_MARGIN_MILLISECOND);
    }

    private clearTick() {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    setHtml(isReset: boolean) {
        setClockText(this.divHour, isReset ? '00' : this.hourStr);
        setClockText(this.divMinute, isReset ? '00' : this.minuteStr);
        setClockText(this.divSecond, isReset ? '00' : this.secondStr);
        setClockText(this.divAmPm, isReset ? '' : this.periodStr);
    }

    pause() {
        this.isRunning = false;
        this.clearTick();
    }

    stop() {
        this.pause();
        this.setHtml(true);
    }

    static init(
        divContainer: HTMLDivElement,
        timezoneMinuteOffset: number,
        is24HourFormat = false,
        toPeriodText?: (period: ClockPeriodType) => string,
    ) {
        return new this(
            divContainer,
            timezoneMinuteOffset,
            is24HourFormat,
            toPeriodText,
        );
    }
}
