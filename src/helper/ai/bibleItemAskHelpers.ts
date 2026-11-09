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
import type { SelectionMentionType } from './chatbotHandoffStoreHelpers';
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

async function openWithAsk(
    ask: LookupAskType,
    mention: SelectionMentionType | string | null = null,
) {
    const { openChatbotWithLookup } = await import('./chatbotHandoffHelpers');
    // The words selected ride only when there are some: a passage asked
    // about whole is the request it always was.
    return mention === null
        ? await openChatbotWithLookup(ask)
        : await openChatbotWithLookup(ask, mention);
}

/** The whole passage a view shows. */
export async function openChatbotWithBibleItem(bibleItem: BibleItem) {
    return await openWithAsk(await toPassageAsk(bibleItem));
}

/**
 * One verse, by the key its element carries (`(KJV) GEN 4:1`); false when the
 * key reads as no verse. From a Bible view's selection toolbar (2026-11-08,
 * the user: _add the agent button for bible selected text as well_), the
 * words selected in it ride along (`mention`) and are quoted in the box.
 */
export async function openChatbotWithVerseKey(
    bibleVersesKey: string,
    mention: SelectionMentionType | string | null = null,
) {
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
    return await openWithAsk(await toPassageAsk(bibleItem), mention);
}
