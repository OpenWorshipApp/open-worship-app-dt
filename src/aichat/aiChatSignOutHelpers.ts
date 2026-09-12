// Sign out of every site: the other half of what the AI Chat window keeps.
//
// A tab is a setting file (`aiChatSessionHelpers.ts`); a sign-in is a
// Chromium profile beside it, on the persistent `persist:aichat` partition,
// and closing every tab never touched one. On a computer several people use
// -- the normal case in a church back room -- that is the half that matters,
// so the window offers this and the main process does it
// (`clearAiChatGuestData`, `electron/aiChatGuestHelpers.ts`).
//
// Its own file rather than a function in `aiChatSessionHelpers.ts`: that one
// is pure but for the setting store, and `electronSendAsync` reaches
// `appProvider`, which touches `document` when it loads and takes every
// node-environment test importing it down with it.

import { electronSendAsync } from '../server/appHelpers';

/** Throws the guest partition away. The window asks, twice, before this. */
export function clearAiChatSiteData() {
    return electronSendAsync<boolean>('main:app:clear-ai-chat-data');
}
