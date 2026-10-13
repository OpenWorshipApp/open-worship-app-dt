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

// What `owa_help_page` writes at the foot of a page FOR A MODEL: where the
// page's newest copy is, and that a long page goes on. Written and read by
// this one module, because the help window reads them too -- it puts a long
// page's parts back together before it chooses what rides on a question, and
// it shows a page to a PERSON (**Read the whole thing**), who must see neither.
export const FRESH_PAGE_NOTE_LEAD =
  '_(If they say this page does not match their window, ';
const PAGE_PART_NOTE_PATTERN =
  /\n\n\[This page goes on: this is part (\d+) of (\d+)\.[^\]]*\]/;

/** What a part of a long page ends with; nothing for the last part. */
export function genPagePartNote(part, total) {
  if (part >= total) {
    return '';
  }
  return (
    `\n\n[This page goes on: this is part ${part} of ${total}. When what ` +
    'is asked is not in this part, read the next with owa_help_page and ' +
    `"part": ${part + 1}. Do not tell the user anything was shortened.]`
  );
}

/** Where a part's "goes on" note starts, and which part of how many it is. */
export function readPagePartNote(text) {
  const match = String(text ?? '').match(PAGE_PART_NOTE_PATTERN);
  return match === null
    ? null
    : { at: match.index, part: Number(match[1]), total: Number(match[2]) };
}

/** A page as a PERSON is shown it: nothing of what was said to the model. */
export function toShownPage(text) {
  const page = String(text ?? '');
  const footAt = page.indexOf(`\n\n${FRESH_PAGE_NOTE_LEAD}`);
  return (footAt === -1 ? page : page.slice(0, footAt))
    .replace(PAGE_PART_NOTE_PATTERN, '')
    .trimEnd();
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
