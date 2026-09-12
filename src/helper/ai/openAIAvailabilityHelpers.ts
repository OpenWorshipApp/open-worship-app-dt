import type { AISettingType } from './aiHelpers';
import { getAISetting, getIsAIEnabled, useAISetting } from './aiHelpers';

// Lives here rather than in `openAIHelpers` for the same reason the two
// functions below do: it is a plain string, and importing it must not cost a
// caller the whole SDK.
export const DATA_DIR_NAME = 'ai-openai-data';

/**
 * "Is OpenAI usable?" WITHOUT dragging the OpenAI SDK in.
 *
 * These two used to live in `openAIHelpers`, which imports the `openai` package
 * at module scope. A component that only wanted to know whether to draw an AI
 * control -- `BibleCrossRefRendererComp` does exactly that -- therefore pulled
 * the whole SDK into its chunk, and the Presenter fetched it on every cold boot
 * with no key set and nothing AI on screen. This app targets low-spec machines,
 * so boot work nobody asked for is the expensive kind.
 *
 * Anything that actually CALLS OpenAI still imports `openAIHelpers` and pays for
 * the SDK then, which is when it is really needed.
 */
export function checkIsAvailable(aiSetting?: AISettingType) {
    const setting = aiSetting ?? getAISetting();
    return getIsAIEnabled() && setting.openAIAPIKey.trim().length > 0;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return checkIsAvailable(aiSetting);
}
