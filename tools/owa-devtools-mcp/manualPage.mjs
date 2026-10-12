// What a manual page's FILE holds around the page itself, read in one place
// for its two readers: `help.mjs`, for the copy built into the app, and the
// help window, for the copy it reads off the project's repository when
// somebody says an answer is wrong (`src/chatbot/disputeHelpers.ts`). No
// `node:fs` here, so the renderer bundles the module the server runs.

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

/**
 * The day the page was generated from the manual (`2026-10-11`), or null.
 * It is what tells two copies of one page apart: the copy on the repository
 * is the newer one only when its day is LATER, and a build made from a branch
 * ahead of `main` carries pages the repository does not have yet.
 */
export function readManualPageDate(content) {
  const frontMatter =
    String(content ?? '').match(FRONT_MATTER_PATTERN)?.[1] ?? '';
  return (
    frontMatter.match(/^workflowsVersion:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1] ??
    null
  );
}

/** The page as a reader is shown it. */
export function toManualPageBody(content) {
  return (
    String(content ?? '')
      .replace(FRONT_MATTER_PATTERN, '')
      .replace(/:::\s*details[\s\S]*?:::\s*/g, '')
      // A page cut short inside such a block has no closing mark, and what
      // the block holds is the QA robot's version, not a volunteer's.
      .replace(/:::\s*details[\s\S]*$/, '')
      // The manual's own mark for "a screenshot belongs here". It means
      // something on the documentation site and nothing in a chat, and a
      // model handed it pastes it into the answer, where it reads as an
      // instruction to look at a picture that does not exist.
      .replace(/[ \t]*📸/g, '')
      .trim()
  );
}
