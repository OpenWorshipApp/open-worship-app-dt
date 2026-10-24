/**
 * The menu of a name's or a place's row -- the Names and Places panel's list
 * and the reading tab's (2026-10-22, the user with a row's `⋮` circled, which
 * held Open Graph Preview alone: _contextmenu of the item should have `Open`
 * `Copy` and `Open in Chatbot`_). Each does what the record's detail panel
 * does, without opening the panel first: Open is the row's own click, Copy
 * writes what the panel's Copy writes, and Open in Chatbot asks the way the
 * panel's 🤖 does -- offered, like the 🤖, only while AI is on.
 *
 * Nothing heavy comes with a list of rows. The ~34MB dataset Copy reads is
 * acquired at the press and released once the copy is written -- the Names
 * and Places panel already holds it, so there it costs nothing -- and the
 * assistant's dialogs and window opener are loaded at the press as well.
 */
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { genGraphPreviewContextMenuItems } from '../graph-view/graphContextMenuHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { DetailPanelKindType } from './detailPanelHelpers';
import { openDetailPanel } from './detailPanelHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import { getSelectedLookupLangCode } from './lookupLangHelpers';
import {
    buildLocationSummary,
    buildNameSummary,
    copyRecordToClipboard,
} from './lookupRecordHelpers';

export type LookupRecordKindType = Exclude<DetailPanelKindType, 'verse'>;

export type LookupRecordMenuTargetType = {
    kind: LookupRecordKindType;
    recordId: string;
    // The record's name as the row shows it, in the lookup language.
    name: string;
};

export function openLookupRecordDetailPanel(
    target: Readonly<LookupRecordMenuTargetType>,
) {
    openDetailPanel({
        kind: target.kind,
        target: target.recordId,
        name: target.name,
    });
}

/**
 * With the raw references for its verses, as the panel copies before its
 * Verses section has been expanded: reading each one's title would be
 * dozens of bible reads for one copy, and an empty list would DROP the row.
 */
function buildRecordSummary(
    managers: LookupManagersType,
    target: Readonly<LookupRecordMenuTargetType>,
) {
    if (target.kind === 'name') {
        const record = managers.namesLookupManager.getRecordById(
            target.recordId,
        );
        return record === null
            ? null
            : buildNameSummary(managers, record, record.verses);
    }
    const record = managers.locationsLookupManager.getRecordById(
        target.recordId,
    );
    return record === null
        ? null
        : buildLocationSummary(
              managers.locationsLookupManager,
              record,
              record.verses,
          );
}

export async function copyLookupRecord(
    target: Readonly<LookupRecordMenuTargetType>,
) {
    const langCode = getSelectedLookupLangCode();
    const { acquireLookupData, releaseLookupData } =
        await import('./lookupDataHelpers');
    try {
        const summary = buildRecordSummary(
            await acquireLookupData(langCode),
            target,
        );
        if (summary === null) {
            return false;
        }
        await copyRecordToClipboard(summary.plainText, summary.html);
        return true;
    } finally {
        // The acquire counted even when its load failed.
        releaseLookupData(langCode);
    }
}

export function openLookupRecordInChatbot(
    target: Readonly<LookupRecordMenuTargetType>,
) {
    // What the 🤖 of the panel this row opens would hand over.
    const ask: LookupAskType = {
        kind: target.kind,
        target: target.recordId,
        title: target.name,
        langCode: getSelectedLookupLangCode(),
        page: globalThis.location?.href ?? '',
    };
    import('../helper/ai/chatbotHandoffHelpers')
        .then(({ openChatbotWithLookup }) => {
            return openChatbotWithLookup(ask);
        })
        .catch(handleError);
}

export function genLookupRecordContextMenuItems(
    target: Readonly<LookupRecordMenuTargetType>,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('box-arrow-up-right'),
            menuElement: tran('Open'),
            onSelect: () => {
                openLookupRecordDetailPanel(target);
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy'),
            menuElement: tran('Copy'),
            onSelect: () => {
                copyLookupRecord(target)
                    .then((isCopied) => {
                        if (isCopied) {
                            showSimpleToast(
                                tran('Copy'),
                                tran('Text has been copied to clipboard'),
                            );
                        }
                    })
                    .catch(handleError);
            },
        },
        ...(getIsAIEnabled()
            ? [
                  {
                      childBefore: genContextMenuItemIcon('robot'),
                      menuElement: tran('Open in Chatbot'),
                      onSelect: () => {
                          openLookupRecordInChatbot(target);
                      },
                  },
              ]
            : []),
        ...genGraphPreviewContextMenuItems({
            kind: target.kind,
            recordId: target.recordId,
            name: target.name,
        }),
    ];
}

export function showLookupRecordContextMenu(
    event: MouseEvent,
    target: Readonly<LookupRecordMenuTargetType>,
) {
    showAppContextMenu(event, genLookupRecordContextMenuItems(target));
}
