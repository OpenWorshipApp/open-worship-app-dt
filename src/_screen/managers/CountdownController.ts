export default class CountdownController {
    readonly divContainer: HTMLDivElement;
    readonly targetDateTime: Date;
    isRunning = true;

    constructor(divContainer: HTMLDivElement, targetDateTime: Date) {
        this.divContainer = divContainer;
        this.targetDateTime = targetDateTime;
        this.setHtml(false);
    }

    get timeDiff() {
        return Math.max(0, this.targetDateTime.getTime() - Date.now());
    }

    get hours() {
        return Math.floor(
            (this.timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
    }

    get minutes() {
        return Math.floor((this.timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    }

    get seconds() {
        return Math.floor((this.timeDiff % (1000 * 60)) / 1000);
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
        const update = () => {
            if (!this.isRunning) {
                return;
            }
            if (this.timeDiff > 0) {
                this.setHtml(false);
                requestAnimationFrame(update);
            } else {
                this.stop();
            }
        };
        requestAnimationFrame(update);
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

    static init(divContainer: HTMLDivElement, targetDate: Date) {
        return new this(divContainer, targetDate);
    }
}
