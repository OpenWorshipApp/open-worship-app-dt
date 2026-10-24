import { tran } from '../../lang/langHelpers';
import type { ArchiveTreeChoiceType } from '../../popup-widget/ArchiveTreeSelectorComp';
import {
    SETTING_SECTION_LIST,
    type SettingLeafType,
} from './settingArchiveCatalog';

/**
 * The section tree of `settingArchiveCatalog` as the rows of
 * `ArchiveTreeSelectorComp`, for both directions. Called in render or after
 * a click, never at module scope: every title goes through `tran()`.
 */

export type SettingLeafChoiceOptionType = {
    /** Leave the leaf out of the tree entirely. */
    isHidden?: boolean;
    /** A `tran()` key: the row is red and cannot be ticked. */
    invalidMessage?: string;
    isDefaultUnchecked?: boolean;
    /** Print no count -- for a leaf whose settings cannot be counted. */
    isCountHidden?: boolean;
};

function toCountText(count: number) {
    return count > 0 ? `${tran('Settings')}: ${count}` : tran('All default');
}

function toLeafDetail(
    leaf: SettingLeafType,
    count: number,
    isCountHidden: boolean,
) {
    const textList = [
        ...(leaf.noteKey ? [tran(leaf.noteKey)] : []),
        ...(isCountHidden ? [] : [toCountText(count)]),
    ];
    return textList.length > 0 ? textList.join(' · ') : undefined;
}

export function genSettingTreeChoices(
    countByLeafId: Map<string, number>,
    toLeafOption: (leaf: SettingLeafType) => SettingLeafChoiceOptionType,
): ArchiveTreeChoiceType[] {
    const choices: ArchiveTreeChoiceType[] = [];
    for (const section of SETTING_SECTION_LIST) {
        let sectionCount = 0;
        let isSectionCounted = false;
        const children: ArchiveTreeChoiceType[] = [];
        for (const leaf of section.leaves) {
            const option = toLeafOption(leaf);
            if (option.isHidden) {
                continue;
            }
            const count = countByLeafId.get(leaf.id) ?? 0;
            sectionCount += count;
            isSectionCounted ||= !option.isCountHidden;
            children.push({
                key: leaf.id,
                title: tran(leaf.titleKey),
                iconClassName: leaf.iconClassName,
                detail: toLeafDetail(leaf, count, !!option.isCountHidden),
                invalidMessage: option.invalidMessage
                    ? tran(option.invalidMessage)
                    : undefined,
                isDefaultUnchecked: option.isDefaultUnchecked,
            });
        }
        if (children.length === 0) {
            continue;
        }
        // A section that is nothing but one leaf of the same name ("Other
        // Settings") is drawn as that leaf, not as a parent of itself.
        const [onlyChild] = children;
        if (
            children.length === 1 &&
            section.leaves.length === 1 &&
            section.titleKey === section.leaves[0].titleKey
        ) {
            choices.push(onlyChild);
            continue;
        }
        choices.push({
            key: section.id,
            title: tran(section.titleKey),
            iconClassName: section.iconClassName,
            // Nothing printed for a section none of whose settings are
            // counted: "All default" there would be a guess.
            detail: isSectionCounted ? toCountText(sectionCount) : undefined,
            children,
        });
    }
    return choices;
}
