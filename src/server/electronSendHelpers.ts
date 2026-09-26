import appProvider from './appProvider';
import type { AnyObjectType } from '../helper/typeHelpers';

export function genReturningEventName(eventName: string) {
    return `${eventName}-return-${crypto.randomUUID()}`;
}

export function electronSendAsync<T, TProgress = unknown>(
    eventName: string,
    data: AnyObjectType = {},
    onProgress?: (progress: TProgress) => void,
) {
    return new Promise<T>((resolve, reject) => {
        const replyEventName = genReturningEventName(eventName);
        const progressEventName = `${replyEventName}-progress`;
        const progressListener = (_event: unknown, progress: TProgress) => {
            onProgress?.(progress);
        };
        if (onProgress) {
            appProvider.messageUtils.listenForData(
                progressEventName,
                progressListener,
            );
        }
        appProvider.messageUtils.listenOnceForData(
            replyEventName,
            (_event, imageData: T) => {
                if (onProgress) {
                    appProvider.messageUtils.removeListener(
                        progressEventName,
                        progressListener,
                    );
                }
                if (imageData instanceof Error) {
                    return reject(imageData);
                }
                resolve(imageData);
            },
        );
        appProvider.messageUtils.sendData(eventName, {
            ...data,
            replyEventName,
            ...(onProgress ? { progressEventName } : {}),
        });
    });
}
