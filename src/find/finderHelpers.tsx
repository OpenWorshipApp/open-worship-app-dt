import appProvider from '../server/appProvider';

export type LookupOptions = {
    forward?: boolean;
    findNext?: boolean;
    matchCase?: boolean;
};

export function findString(text: string, options: LookupOptions = {}) {
    if (!text) {
        appProvider.messageUtils.sendData(
            'finder:app:stop-search-in-page',
            'clearSelection',
        );
        return;
    }
    appProvider.messageUtils.sendDataSync(
        'finder:app:search-in-page',
        text,
        options,
    );
}
