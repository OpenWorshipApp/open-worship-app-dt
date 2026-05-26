export default class TimingController {
    readonly divContainer: HTMLDivElement;
    readonly timezoneMinuteOffset: number;
    readonly is24HourFormat: boolean;
    isRunning = true;

    constructor(
        divContainer: HTMLDivElement,
        timezoneMinuteOffset: number,
        is24HourFormat = false,
    ) {
        this.divContainer = divContainer;
        this.timezoneMinuteOffset = timezoneMinuteOffset;
        this.is24HourFormat = is24HourFormat;
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

    get periodStr() {
        return this.hours >= 12 ? 'PM' : 'AM';
    }

    get minuteStr() {
        return this.toTimeString(this.minutes);
    }

    get secondStr() {
        return this.toTimeString(this.seconds);
    }

    start() {
        const updateTime = () => {
            if (!this.isRunning) {
                return;
            }
            this.setHtml(false);
            requestAnimationFrame(updateTime);
        };
        requestAnimationFrame(updateTime);
    }

    setHtml(isReset: boolean) {
        this.divHour.innerHTML = isReset ? '00' : this.hourStr;
        this.divMinute.innerHTML = isReset ? '00' : this.minuteStr;
        this.divSecond.innerHTML = isReset ? '00' : this.secondStr;
        if (this.divAmPm !== null) {
            this.divAmPm.innerHTML = isReset ? '' : this.periodStr;
        }
    }

    pause() {
        this.isRunning = false;
    }

    stop() {
        this.pause();
        this.setHtml(true);
    }

    static init(
        divContainer: HTMLDivElement,
        timezoneMinuteOffset: number,
        is24HourFormat = false,
    ) {
        return new this(divContainer, timezoneMinuteOffset, is24HourFormat);
    }
}
