import appProvider from './appProvider';
import type { AnyObjectType } from '../helper/typeHelpers';

export function genReturningEventName(eventName: string) {
    return `${eventName}-return-${crypto.randomUUID()}`;
}

export function electronSendAsync<T>(
    eventName: string,
    data: AnyObjectType = {},
) {
    return new Promise<T>((resolve, reject) => {
        const replyEventName = genReturningEventName(eventName);
        appProvider.messageUtils.listenOnceForData(
            replyEventName,
            (_event, imageData: T) => {
                if (imageData instanceof Error) {
                    return reject(imageData);
                }
                resolve(imageData);
            },
        );
        appProvider.messageUtils.sendData(eventName, {
            ...data,
            replyEventName,
        });
    });
}
