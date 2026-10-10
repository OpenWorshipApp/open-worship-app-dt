/**
 * A part of the Others tab folded to its header row, and opened again.
 *
 * Asked for on 2026-10-10 with two pictures of that tab: _make sections in
 * setting to be collapsible_, then, of the provider boxes inside AI Providers,
 * _make the nested sections collapsible as well_. **AI Providers** alone had
 * grown past a full window -- four provider boxes and a list of the user's own
 * servers -- so the two sections under it were reached only by scrolling past
 * all of it, and a server was reached only by scrolling past every provider.
 *
 * Folded is not hidden: the header that stays says what the fold holds -- a
 * section keeps its state rail, state pill and the control that changes that
 * state, a provider box a tick when its key is saved, a server its name and
 * how many models it offers. What is folded away is not mounted at all
 * (`useSettingSectionFold`).
 *
 * Remembered per part, and open on a fresh install: a first run has to show
 * where the keys go, and a fold is only ever a thing the user did.
 */
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';

// Everything that folds. A union rather than a string, so two parts cannot
// come to share one remembered fold by a typo.
export type SettingSectionFoldNameType =
    | 'ai'
    | 'song-select'
    | 'extra-bin'
    | 'ai-openai'
    | 'ai-anthropic'
    | 'ai-kimi'
    | 'ai-bedrock'
    | 'ai-custom-servers'
    | `ai-custom-server-${string}`;

// Claimed by `layout.windows` in `settingArchiveCatalog` by this prefix.
const SECTION_COLLAPSED_SETTING_PREFIX = 'setting-section-collapsed-';

function toSettingName(foldName: SettingSectionFoldNameType) {
    return `${SECTION_COLLAPSED_SETTING_PREFIX}${foldName}`;
}

/**
 * One of the user's own servers. Its id is letters, digits and dashes
 * (`ID_PATTERN` in `electron/customLlmProtocol.ts`), so it can be part of a
 * setting's name -- which is a file's name.
 */
export function toCustomServerFoldName(
    serverId: string,
): SettingSectionFoldNameType {
    return `ai-custom-server-${serverId}`;
}

export function getIsSettingSectionCollapsed(
    foldName: SettingSectionFoldNameType,
) {
    return getSetting(toSettingName(foldName)) === 'true';
}

/** One tiny setting, written once per press. */
export function saveIsSettingSectionCollapsed(
    foldName: SettingSectionFoldNameType,
    isCollapsed: boolean,
) {
    setSetting(toSettingName(foldName), isCollapsed ? 'true' : 'false');
}

/** For a part that is gone for good: a deleted server takes its fold with it. */
export function forgetIsSettingSectionCollapsed(
    foldName: SettingSectionFoldNameType,
) {
    removeSetting(toSettingName(foldName));
}
