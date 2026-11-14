import appProvider from '../server/appProvider';

/**
 * "Open this person, place or verse in the Reader" -- asked by a window that
 * hosts no detail panels of its own (the Markdown Preview, 2026-11-11, the
 * user: _for name/location-name/bible-verse have to open the floating panel
 * in reader page_), heard by ONE window: main picks a window showing the
 * Reader page, else the main window on whatever page it shows -- never
 * navigating away from a Presenter mid-service -- brings it forward and hands
 * it the request (`electron/detailPanelRequestHelpers.ts`).
 *
 * A LEAF: the asking window is locked down and imports nothing that carries
 * module-level listeners. What arrives is checked field by field both ways,
 * because it crosses a process: a record id, a short verse and a title, and
 * for a verse the Bible it was written in.
 */

export const DETAIL_PANEL_REQUEST_CHANNEL = 'all:app:open-detail-panel';
export const DETAIL_PANEL_RENDERER_CHANNEL = 'main:app:open-detail-panel';

const MAX_TEXT_LENGTH = 200;
const MAX_BIBLE_KEY_LENGTH = 100;

export type DetailPanelRequestType = {
    kind: 'name' | 'location' | 'verse';
    // A record id for a person or a place, a short verse (`EZK 36:25-27`).
    target: string;
    // What the panel's title says until it has read the record.
    name: string;
    // A verse written as one Bible names its book reads in that Bible.
    bibleKey?: string;
};

function toCheckedText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim();
    if (text === '' || text.length > maxLength) {
        return null;
    }
    return text;
}

export function toValidDetailPanelRequest(
    data: unknown,
): DetailPanelRequestType | null {
    if (data === null || typeof data !== 'object') {
        return null;
    }
    const { kind, target, name, bibleKey } = data as Record<string, unknown>;
    if (kind !== 'name' && kind !== 'location' && kind !== 'verse') {
        return null;
    }
    const checkedTarget = toCheckedText(target, MAX_TEXT_LENGTH);
    const checkedName = toCheckedText(name, MAX_TEXT_LENGTH);
    if (checkedTarget === null || checkedName === null) {
        return null;
    }
    const request: DetailPanelRequestType = {
        kind,
        target: checkedTarget,
        name: checkedName,
    };
    if (bibleKey !== undefined) {
        const checkedBibleKey = toCheckedText(bibleKey, MAX_BIBLE_KEY_LENGTH);
        if (checkedBibleKey === null) {
            return null;
        }
        // A Bible belongs to a verse alone: a record keeps its language.
        if (kind === 'verse') {
            request.bibleKey = checkedBibleKey;
        }
    }
    return request;
}

/** Asks main to open it in the Reader. False when it was not sent. */
export function requestDetailPanelInReader(request: DetailPanelRequestType) {
    const validRequest = toValidDetailPanelRequest(request);
    if (validRequest === null) {
        return false;
    }
    appProvider.messageUtils.sendData(
        DETAIL_PANEL_REQUEST_CHANNEL,
        validRequest,
    );
    return true;
}

/** What a window that hosts detail panels hears. Returns the unregister. */
export function registerDetailPanelRequestListener(
    handler: (request: DetailPanelRequestType) => void,
) {
    const listener = (_event: unknown, data?: unknown) => {
        const request = toValidDetailPanelRequest(data);
        if (request !== null) {
            handler(request);
        }
    };
    appProvider.messageUtils.listenForData(
        DETAIL_PANEL_RENDERER_CHANNEL,
        listener,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            DETAIL_PANEL_RENDERER_CHANNEL,
            listener,
        );
    };
}
