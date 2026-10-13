// How a message says it belongs to a problem report. A leaf with nothing in
// it but these words, so the tab strip (`chatSessionHelpers`) can tell a
// reporting tab without loading everything a report is written with
// (`reportHelpers`, which re-exports them).

/** The note on every message a person adds to a report. */
export const REPORT_NOTE = 'Reporting a problem.';
/** The pseudo tool on the card that offers a report: its Report button. */
export const REPORT_START_TOOL_NAME = 'owa-report-start';
/** The pseudo tool the Send button of a prepared report carries. */
export const REPORT_SEND_TOOL_NAME = 'owa-report-send';

/**
 * The two buttons under a way to put the problem right, which the assistant
 * tries before any report (2026-10-13, the user's words: _some problem is
 * not issue, it is user problem so before helping user to report let try to
 * help user to resolve it first_). Pseudo tools like Send.
 */
export const REPORT_FIXED_TOOL_NAME = 'owa-report-fixed';
export const REPORT_STILL_TOOL_NAME = 'owa-report-still';
/** The note on the line that closes a report nobody had to send. */
export const REPORT_RESOLVED_NOTE = 'Solved without a report.';

/** What a reporting tab's name opens with (the user's ask, 2026-10-13). */
export const REPORT_TITLE_PREFIX = 'Report: ';
