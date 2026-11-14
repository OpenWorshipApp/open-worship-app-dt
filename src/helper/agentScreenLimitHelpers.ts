/**
 * The most screens the assistant adds to (2026-11-14, EC-630): a person
 * adds more from the Mini Screen menu. Each screen draws a preview of its
 * own, live, on a computer that may have little to spare, and a model that
 * took one answer for a failure would add another.
 *
 * A leaf of its own: the screens' worker refuses at it
 * (`agentScreenControlHelpers.ts`), and the help window offers its
 * **Add New Screen** press only under it (`screenChangeOfferHelpers.ts`),
 * which must not pull the screens' worker into the help window.
 */
export const MAX_AGENT_SCREEN_COUNT = 8;
