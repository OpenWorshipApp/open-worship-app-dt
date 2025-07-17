export default class TimingController {
    readonly divContainer: HTMLDivElement;
    readonly timezoneMinuteOffset: number;
    isRunning = true;

    constructor(divContainer: HTMLDivElement, timezoneMinuteOffset: number) {
        this.divContainer = divContainer;
        this.timezoneMinuteOffset = timezoneMinuteOffset;
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
    }

    pause() {
        this.isRunning = false;
    }

    stop() {
        this.pause();
        this.setHtml(true);
    }

    static init(divContainer: HTMLDivElement, timezoneMinuteOffset: number) {
        return new this(divContainer, timezoneMinuteOffset);
    }
}
