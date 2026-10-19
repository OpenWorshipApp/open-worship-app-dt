/**
 * A passage a Bible view shows -- or one verse of it -- asked about in the
 * assistant, exactly as a Lookup Detail verse panel's 🤖 asks
 * (`lookupAskHelpers.ts`): the chat opens a tab of its own, reads the passage
 * through `owa_lookup_record` and is ready to be asked about it.
 *
 * Asked for with a picture of a Bible view's header toolbar circled
 * (2026-10-18): _add robot icon to part of the icon and add contextmenu to
 * verse preview content. to open the verse in chatbot like open from
 * floating verse detail panel_.
 *
 * Imported at the press, never with the view: the dialogs the assistant asks
 * first and the window opener are nothing a pane of verses needs until then.
 */
import BibleItem from '../../bible-list/BibleItem';
import type { LookupAskType } from './lookupAskHelpers';
import { readBibleVersesKey } from './lookupAskHelpers';

async function toPassageAsk(bibleItem: BibleItem): Promise<LookupAskType> {
    return {
        kind: 'verse',
        target: bibleItem.toVerseFullKey(),
        title: await bibleItem.toTitle(),
        bibleKey: bibleItem.bibleKey,
        page: globalThis.location?.href ?? '',
    };
}

async function openWithAsk(ask: LookupAskType) {
    const { openChatbotWithLookup } = await import('./chatbotHandoffHelpers');
    return await openChatbotWithLookup(ask);
}

/** The whole passage a view shows. */
export async function openChatbotWithBibleItem(bibleItem: BibleItem) {
    return await openWithAsk(await toPassageAsk(bibleItem));
}

/**
 * One verse, by the key its element carries (`(KJV) GEN 4:1`); false when the
 * key reads as no verse.
 */
export async function openChatbotWithVerseKey(bibleVersesKey: string) {
    const parts = readBibleVersesKey(bibleVersesKey);
    if (parts === null) {
        return false;
    }
    const bibleItem = await BibleItem.fromVerseKey(
        parts.bibleKey,
        parts.verseKey,
    );
    if (bibleItem === null) {
        return false;
    }
    return await openWithAsk(await toPassageAsk(bibleItem));
}
