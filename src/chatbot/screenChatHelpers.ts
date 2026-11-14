/**
 * A conversation about the SCREENS' own controls -- the Bible text's look on
 * every screen, a passage's versions, Line Sync, the transitions, the
 * display, a group, the lock, the tick, the stage, a screen on or off and
 * what is cleared off it: what a Mini Screen card and the Bible text panel
 * hold (2026-11-13, the user: _chatbot is very smart to help user control
 * screen_ -- _e.g change font-size color or style for bible showing_, _add
 * another bible version to existing showing bible_, _change transition_,
 * _check display_, _group screen_, _should cover everything in screen
 * control_).
 *
 * Measured first through the help window on a scratch profile
 * (`references/screen-asks.json`, 27 asks on Auto): not one of the 23 asks
 * to change something was done. The ordinary assistant has no tool for any
 * of it and answered with the panel's steps, nine of them wrong.
 *
 * The foreground's conversation is the shape (`foregroundChatHelpers.ts`):
 * a typed line about a screen control is a `screen` ask, the window reads
 * the screens as they stand NOW through `owa_screen_edit read` and puts
 * them under the question as plain lines, and the ask goes out under its
 * own prompt with that tool, offered to no other question. Its answer is
 * marked (`isScreenAnswer`), so the next plain line typed under it -- _make
 * it yellow_, _centre it_, _undo that_ -- is more of the same conversation,
 * in whatever language it is typed.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import { tran } from './chatTranHelpers';
import type { EditedLyricType } from './lyricChatHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';

export const SCREEN_ASK_KIND = 'screen';
export const SCREEN_EDIT_TOOL_NAME = 'owa_screen_edit';
// A read, a change, a retry after a refusal, a page switched to, a verse put
// up, and the answer.
export const SCREEN_MAX_TOOL_ROUNDS = 6;
/**
 * `kind` on an Undo press of a screen answer: the window says its own
 * sentence once it is done (_The screens are back as they were before that
 * change._).
 */
export const SCREEN_UNDO_KIND = 'screen';
// What an edited screen is called on the watch: never a document's row.
const SCREEN_EDITED_NAME = 'screens';
const SCREEN_EDITED_LIST_NAME = 'Mini Screen';
// What one read may cost the question it rides on.
const MAX_SCREEN_READ_CHARS = 3500;
const MAX_READ_SCREENS = 12;

export type ScreenAskKindType =
    | 'style'
    | 'versions'
    | 'lineSync'
    | 'transition'
    | 'display'
    | 'group'
    | 'lock'
    | 'stage'
    | 'select'
    | 'clear'
    | 'newScreen';

// --- the ask, read off English words ----------------------------------------

function toAskLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// What a line names in other words, put the way the reader reads it
// (2026-11-14, the blind set E): a monitor misspelt; a screen named by the
// wall it is on (_pull the background video off the back wall_), unless a
// screen named is ON that wall; a Bible named in full (_the King James and
// the NLT together_), the longer names first.
const WALL_SCREEN_PATTERN =
    /(?<!\b(?:screens?|project[eo]rs?|tvs?|televisions?|monitors?|displays?)\s+(?:on|at|by|against)\s+(?:the\s+)?)\b(back|side|front|rear|left|right)\s+walls?\b(?!\s+(?:screens?|project[eo]rs?|tvs?|monitors?|displays?)\b)/g;
const BIBLE_FULL_NAME_LIST: [RegExp, string][] = [
    [/\bnew\s+king\s+james(?:\s+(?:version|bible))?\b/g, 'nkjv'],
    [/\bking\s+james(?:\s+(?:version|bible))?\b/g, 'kjv'],
    [/\bnew\s+international(?:\s+version)?\b/g, 'niv'],
    [/\benglish\s+standard(?:\s+version)?\b/g, 'esv'],
    [/\bnew\s+living(?:\s+translation)?\b/g, 'nlt'],
    [/\bnew\s+american\s+standard(?:\s+(?:bible|version))?\b/g, 'nasb'],
    [/\bchristian\s+standard(?:\s+bible)?\b/g, 'csb'],
    [/\bnew\s+revised\s+standard(?:\s+version)?\b/g, 'nrsv'],
    [/\brevised\s+standard(?:\s+version)?\b/g, 'rsv'],
    [/\bamerican\s+standard\s+version\b/g, 'asv'],
    [/\bgood\s+news\s+(?:bible|translation)\b/g, 'gnt'],
    [/\bberean\s+standard(?:\s+bible)?\b/g, 'bsb'],
    [/\blegacy\s+standard(?:\s+bible)?\b/g, 'lsb'],
    [/\bcontemporary\s+english(?:\s+version)?\b/g, 'cev'],
    [/\bcommon\s+english(?:\s+bible)?\b/g, 'ceb'],
    [/\byoung'?s\s+literal(?:\s+translation)?\b/g, 'ylt'],
];

function toReadAskLine(line: string) {
    let readLine = line
        .replace(/\bmonit(?:io|e)r(s?)\b/g, 'monitor$1')
        .replace(WALL_SCREEN_PATTERN, '$1-wall screen');
    for (const [pattern, name] of BIBLE_FULL_NAME_LIST) {
        readLine = readLine.replace(pattern, name);
    }
    return readLine;
}

// A how-to is the guide's, with its walkthrough; a request is this
// conversation's. "Can you" asks for it, "can I" asks how.
// "What does the lock do?" and "can one slide have its own transition?" ask
// how the app works -- the guide's too -- and "who published this version?"
// is not about a screen at all.
const HOW_TO_PATTERN =
    /^(?:how\s+(?:do|can|could|would|should|does|to)\b|how\s+do\s+you\b|where\s+(?:do|can|is|are|does|would|should)\b|where'?s\b|which\s+button\b|can\s+i\b|is\s+(?:it|there)\s+(?:possible|a\s+way)\b|(?:can|could|will|would|should)\s+(?!you\b)|who\b)/;
// A how-to asked inside a request: _could you explain how I would add a
// second Bible version?_ -- or after a few words of its own: _sorry, total
// beginner here, how do I make the bible text bigger?_, _what does line sync
// do and where do I switch it on?_ (2026-11-14, the blind set E).
const HOW_TO_INNER_PATTERN =
    /\b(?:explain|tell\s+me|show\s+me|teach\s+me|walk\s+me\s+through)\s+(?:how|where|the\s+steps)\b|\bhow\s+(?:i|we|one)\s+(?:would|could|can|should|do|might|go\s+about)\b|\bwhat\s+(?:are\s+)?the\s+steps\b|\bhow\s+(?:do|can|could|would|should)\s+(?:i|we|one)\b|\bhow\s+do\s+you\b|\bwhere\s+(?:do|can|could|would|should)\s+(?:i|we|you)\b|\bwhere'?s\s+the\s+(?:[\w-]+\s+)?(?:button|setting|option|switch|toggle|control)s?\b|\bwhat\s+(?:does\s+(?:the\s+|this\s+|that\s+)?[\w-]+(?:\s+[\w-]+){0,3}|do\s+(?:the|these|those)\s+[\w-]+(?:\s+[\w-]+){0,3})\s+do\b/;
const WHAT_DOES_PATTERN =
    /^what\s+(?:does|do|is|are)\b.*\b(?:do|for|mean|means)\??$/;

// The screens themselves, a numbered one, or every one. A line that STARTS
// with "display" uses it as a verb (_display John 3:16_), which names no
// screen.
const SCREEN_PATTERN =
    /\b(?:screens?|project[eo]rs?|displays?|monitors?|tvs?|televisions?|mini\s*screens?)\b/;
const NUMBERED_SCREEN_PATTERN =
    /\bscreens?\s*(?:#\s*|no\.?\s*|number\s*)?(?:\d{1,2}|zero|one|two|three|four)\b/;
const SCREEN_WORD_GLOBAL_PATTERN =
    /\b(?:screens?|project[eo]rs?|tvs?|televisions?|monitors?)\b/g;
// A screen called by what it is for -- _the stage monitor_, _the
// confidence monitor_, _the foyer TV_ -- names a screen, not a display to
// put one on (2026-11-14, the blind set D: _get psalm 23 up on the stage
// monitor_ had been read as about the display).
const SCREEN_ROLE_NAME_PATTERN =
    /\b(?:stage|confidence|foldback|lobby|foyer|balcony|overflow(?:\s+room)?|nursery|hallway|entrance|kids'?|children'?s)\s+(?:monitors?|displays?|tvs?|screens?|project[eo]rs?)\b/g;
const READER_PAGE_PATTERN = /\b(?:bible\s+)?reader\b/;
const ALL_SCREENS_PATTERN =
    /\b(?:both|all|every|each|the\s+two|two)\s+(?:of\s+the\s+)?(?:the\s+)?screens?\b|\b(?:left|right|front|back|side|main|stage|first|second|third|top|bottom)\s+(?:and|&|\+)\s+(?:the\s+)?(?:left|right|front|back|side|main|stage|first|second|third|top|bottom)\s+(?:screens|project[eo]rs|tvs|monitors)\b/;

const TRANSITION_PATTERN =
    /\b(?:transitions?|transtions?|transitons?|trasitions?|transistions?)\b/;
// A transition said as the effect between slides, with no word for it
// (2026-11-14, a set written blind: _the slides change too slow, use no
// effect_, _change the effect between slides on all the screens to slide_).
const EFFECT_TRANSITION_PATTERN =
    /\b(?:effects?|animations?)\s+between\s+(?:the\s+)?(?:slides?|backgrounds?|verses?|songs?|pictures?|images?)\b|\b(?:slide|background)\s+(?:effects?|animations?|fades?)\b|\b(?:use|set|want|pick|choose|switch\s+to|change\s+(?:it\s+|that\s+|this\s+)?to)\s+(?:a\s+|an\s+|the\s+|no\s+)?(?:(?:fade|zoom|dissolve|cut|wipe)\s+)?(?:effects?|animations?)\b|\b(?:fade|zoom|dissolve)\s+(?:in\s+)?between\s+(?:the\s+)?(?:slides?|backgrounds?)\b/;
// An effect, a fade or an animation said of a layer the screens change:
// _the slides jump too quickly, can we have a gentle fade instead_, _which
// effect is the background using?_
const EFFECT_WORD_PATTERN =
    /\b(?:effects?|animations?|fades?|fading|dissolves?|cross-?fades?|zoom(?:s|ed|ing)?\s+(?:in|out)|fad(?:e|es|ed|ing)\s+(?:in|out)|(?:a|the|with\s+a)\s+zoom)\b/;
const LAYER_WORD_PATTERN =
    /\b(?:slides?|backgrounds?|bg|foreground|verses?|pictures?|images?|videos?)\b/;
// A sound fading is the media player's, and an effect that did nothing is
// no effect at all.
const EFFECT_EXCLUDE_PATTERN =
    /\b(?:music|audio|sound|volume|tracks?|songs?|had\s+no\s+effect|has\s+no\s+effect|no\s+effect\s+on\s+(?:it|me|this|that)|zoom\s+(?:meeting|call|link|app|session|room)s?)\b/;
// A song's, a slide's or a document's OWN transition is set in its
// editor (W-48), not on a screen -- unless a screen is named.
const TRANSITION_EXCLUDE_PATTERN =
    /\b(?:editor|lyrics?|songs?|document|own\s+transitions?)\b|\b(?:(?:this|that|one|each|every|a)\s+slide'?s|the\s+slide's)\s+(?:own\s+)?(?:transitions?|effects?|animations?)\b/;
// An effect named for what it does -- _turn off the zoom effect_ -- and a
// change between slides said as too sudden (2026-11-14, the blind set C:
// _the slides jump too abruptly, soften it_).
const NAMED_EFFECT_PATTERN =
    /\b(?:fade|fading|zoom|dissolve|cross-?fade|wipe|push|slide-?in)\s+(?:in\s+|out\s+)?(?:effects?|animations?|transitions?)\b/;
const ABRUPT_CHANGE_PATTERN =
    /\b(?:slides?|backgrounds?|pictures?|images?)\b.{0,40}?\b(?:abrupt(?:ly)?|sudden(?:ly)?|jerky)\b|\b(?:smooth(?:er|en)?|soften|gentler)\s+(?:the\s+)?(?:change|switch|move)s?\s+between\b/;
// A foreground extra's Effects are its own panel's, not a screen's.
const FOREGROUND_WORD_PATTERN =
    /\b(?:countdowns?|clocks?|stopwatch(?:es)?|timers?|marquees?|messages?|announcements?|quick\s+text|overlays?)\b/;

const LINE_SYNC_PATTERN = /\b(?:line|verse)[\s-]*sync\b/;
// Two versions kept together, said without the control's name: _sync the
// lines_, _line them up_, _match up_, _align the verses_.
const SYNC_WORD_PATTERN =
    /\b(?:sync(?:ed|ing|s)?|synchroni[sz](?:e|ed|es|ing)|in\s+sync|out\s+of\s+sync|match(?:ing|es)?\s+up|align(?:ed|ing|s)?|line\s+(?:by|for)\s+line|row\s+(?:by|for)\s+row|verse\s+for\s+verse)\b/;
// Two Bibles named a verse apart: _NIV keeps running a verse ahead of KJV_.
const OUT_OF_STEP_PATTERN =
    /\b(?:ahead\s+of|behind|out\s+of\s+step|not\s+lined\s+up|(?:doesn'?t|don'?t|do\s+not|does\s+not)\s+(?:match|line\s+up)|mismatch(?:ed)?)\b/;
const LINE_UP_PATTERN =
    /\bverse\s+by\s+verse\b|\bside\s+by\s+side\b|\bline\s+(?:them|it|the\s+(?:\w+\s+){0,2}?(?:versions|bibles|translations|verses|lines))\s+up\b|\blin(?:e|es|ing)\s+(?:them\s+|it\s+)?up\b|\bin\s+line\b/;
const VERSION_WORD_PATTERN = /\b(?:versions?|translations?|bibles)\b/;

// A display or a monitor as a THING (the display, the projector display,
// display 2, a monitor, how many are connected), never a display's
// language or a new virtual display to make.
const DISPLAY_NOUN_PATTERN =
    /\b(?:the|a|which|what|each|another|this|that|its|their|my|our|other|second|virtual|real|external|built-in|builtin|main|primary|right|wrong|same|new)\s+(?:[\w-]+\s+)?(?:display|monitor)s?\b|\b(?:display|monitor)s?\s*(?:#\s*)?\d+\b|\bmonitors?\b|\bhow\s+many\s+(?:displays|monitors)\b|\b(?:displays|monitors)\s+(?:are\s+)?(?:connected|plugged\s+in|attached|available|detected)\b|\bconnected\s+(?:displays|monitors)\b|\bscreen\s*\d{1,2}(?:'s)?\s+(?:display|monitor)\b|\bscreen\s*(?:zero|one|two|three|four)?'s\s+(?:display|monitor)s?\b/;
// What a virtual display is watched by -- an address, a phone, its sound --
// is Screen Mirror's, set in its own window; a song's or a slide's display
// is the document's.
const DISPLAY_EXCLUDE_PATTERN =
    /\bdisplay\s+(?:language|name|settings?|size|mode|scale|scaling|resolution)\b|\b(?:add|create|make|delete|remove)\s+(?:a\s+|the\s+)?(?:new\s+)?virtual\s+(?:display|screen)s?\b|\b(?:address|url|link|watch(?:ing|es|ed)?|devices?|phones?|tablets?|silent|sound|audio|restarts?|network|wi-?fi|cast(?:ing)?|mirror(?:ing)?)\b|\b(?:lyrics?|songs?|slides?|document|notes?|bible|verses?|text|words|font|clock|time|countdown)\s+display\b/;
// A screen on the wrong monitor: _showing on my laptop instead of the TV_.
const DISPLAY_WRONG_PATTERN =
    /\b(?:on|to)\s+(?:the\s+|my\s+|a\s+)?(?:[\w-]+\s+)?(?:laptop|tv|television|monitor|projector|display|computer)(?:\s+(?:output|screen|display))?\s+instead\s+of\s+(?:on\s+)?(?:the\s+|my\s+|a\s+)?(?:[\w-]+\s+)?(?:laptop|tv|television|monitor|projector|display|computer)\b|\b(?:on|to)\s+the\s+wrong\s+(?:monitor|display|tv|projector)\b/;
// The output a screen goes out of, with a screen named: _send screen 0 to
// the HDMI one_ (the blind set C).
const DISPLAY_OUTPUT_PATTERN =
    /\b(?:hdmi|vga|dvi|displayport|usb-?c|thunderbolt)\b|\b(?:video|display|monitor)\s+(?:out|outputs?|ports?)\b|\b(?:which|what|another|other|second|different)\s+(?:outputs?|ports?)\b/;
// A screen moved onto a monitor: _put the second screen on the TV_, _route
// screen two to the projector output_, _point screen 3 at it_; a monitor just
// plugged in (the blind set E).
const DISPLAY_MOVE_PATTERN =
    /\b(?:move|put|send|switch|drag|shift|change|route|assign)\s+(?:the\s+)?(?:screen\s*(?:#\s*)?(?:\d{1,2}|zero|one|two|three|four)|(?:first|second|third|fourth|other|left|right|main|stage|front|back|side)\s+screen)\s+(?:to|on|onto|over\s+to)\s+(?:the\s+|my\s+|a\s+)?(?:[\w-]+\s+)?(?:tv|television|projector|monitor|laptop|display)\b|\bpoint\s+(?:the\s+)?(?:screen\s*(?:#\s*)?(?:\d{1,2}|zero|one|two|three|four)|(?:first|second|third|fourth|other|left|right|main|stage|front|back|side)\s+screen)\s+(?:at|to|towards?)\b|\b(?:plugged|hooked)\s+(?:in\s+|up\s+)?(?:a|the|another|my|our)\s+(?:new\s+|second\s+|other\s+|extra\s+)?(?:tv|television|monitor|projector|display)\b/;

const GROUP_PATTERN = /\b(?:group(?:ed|ing|s)?|ungroup(?:ed|ing)?|regroup)\b/;
// A group of people is not a group of screens.
const PEOPLE_GROUP_PATTERN =
    /\b(?:small|youth|prayer|life|cell|home|study|bible|women'?s|men'?s|kids|children'?s|worship|music|choir)\s+groups?\b/;
// Two screens showing one thing is what a group does: _make the second
// screen show the same as screen 1_ -- not Screen Mirror, which a phone
// or another computer watches.
const SAME_AS_PATTERN =
    /\bsame\s+(?:as|thing|content|stuff|picture|image|slides?)\b|\bmirror(?:s|ed|ing)?\s+(?:the\s+)?(?:[\w-]+\s+)?(?:screen|projector|tv)\b|\bcop(?:y|ies|ying)\s+(?:of\s+)?(?:the\s+)?(?:(?:screen|projector|tv|monitor)\s*(?:#\s*)?(?:\d{1,2}|zero|one|two|three|four)\b|(?:first|second|third|left|right|main|front|back|side|other|stage|[\w-]+-wall)\s+(?:screen|projector|tv|monitor)\b)/;
// Two screens tied together: _link the tv and the projector so they
// mirror_.
const LINK_SCREENS_PATTERN =
    /\b(?:link|join|pair|tie|combine|match(?:es|ed|ing)?|mirror(?:s|ed|ing)?|cop(?:y|ies|ying)\s+(?:what(?:ever)?|everything|all)|follow(?:s|ing)?\s+(?:what(?:ever)?|everything))\b/;
// A screen taken out of its group: _unlink screen 0, it needs to do its own
// thing_ (the blind set D).
const UNLINK_PATTERN = /\b(?:unlink(?:ed|ing|s)?|un-link(?:ed|ing|s)?)\b/;
// Screen Mirror is the app's own feature; a screen that mirrors another
// is a group: _make the left screen mirror the right screen_.
const SAME_AS_EXCLUDE_PATTERN =
    /\bscreen\s+mirror(?:ing)?\b(?!\s+(?:the|screens?|project[eo]rs?|tvs?|it|that|this|what(?:ever)?|everything)\b)|\b(?:phones?|tablets?|watch(?:ing|es|ed)?|address|url|web|computers?|laptops?|clipboard)\b|\b(?:a|the)\s+links?\b|\blinks?\s+(?:to|for)\b|\bsame\s+as\s+(?:before|usual|always|last\s+(?:time|week|sunday))\b/;

const LOCK_PATTERN = /\b(?:un)?lock(?:ed|ing|s)?\b/;
// A lock said another way, a screen its object: _freeze screen three on what
// it has now_, _protect the right screen from accidental changes_ (the blind
// set D). "The screen keeps freezing" is a fault, not a lock.
const LOCK_WORD_PATTERN =
    /\b(?:un)?freeze\s+(?:the\s+)?(?:[\w-]+\s+)?(?:screens?|project[eo]rs?|tvs?|monitors?)\b|\b(?:un)?freeze\s+screen\b|\b(?:protect|secure|guard)\s+(?:the\s+)?(?:[\w-]+\s+)?(?:screens?|project[eo]rs?|tvs?|monitors?)\b|\bso\s+(?:that\s+)?(?:nobody|no\s+one|nothing|clicks?|the\s+kids|people|anyone)\b.{0,30}?\b(?:change|mess|touch|alter)/;
// On the Presenter, _unlock all_ is the screens' locks.
const LOCK_ALL_PATTERN =
    /^(?:(?:please|pls|now|ok(?:ay)?|just)\s+)*(?:un)?lock\s+(?:all|everything|both|them|it|every\s+one)\b/;

const STAGE_NUMBER_PATTERN =
    /\bstage\s*(?:number\s*|no\.?\s*|#\s*)?(?:\d+|zero|one|two|three|four|five)\b|\bstage\s*(?:#|number\b|no\.)/;
const STAGE_PATTERN = /\bstage\b/;
// A screen MADE the stage one is its stage set: _make the right-hand screen
// the stage display_.
const STAGE_ROLE_PATTERN =
    /\b(?:make|set|use|turn)\s+(?:the\s+)?(?:[\w-]+\s+){0,2}?(?:screens?\s*\d{0,2}|project[eo]rs?|tvs?|monitors?)\s+(?:as\s+|into\s+|to\s+be\s+)?(?:the|a|our)\s+stage\s+(?:screens?|monitors?|displays?|tvs?)\b/;
// A screen CALLED the stage screen names a screen, not its stage number.
const STAGE_SCREEN_NAME_PATTERN =
    /\bstage\s+(?:screens?|monitors?|displays?|tvs?)\b/g;

const SELECT_PATTERN =
    /\b(?:select(?:ed|ing|s)?|deselect(?:ed|ing|s)?|unselect(?:ed|ing|s)?|tick(?:ed|ing|s)?|untick(?:ed|ing|s)?|un-tick(?:ed|ing|s)?|uncheck(?:ed|ing|s)?|solo|selection)\b/;
// Selecting a song, a verse or a file is not ticking a screen.
const SELECT_EXCLUDE_PATTERN =
    /\b(?:select|deselect|unselect|tick|untick|un-tick|solo)\s+(?:the\s+|a\s+|an\s+|this\s+|that\s+|my\s+|all\s+(?:the\s+)?)?(?:[\w-]+\s+)?(?:songs?|lyrics?|slides?|files?|documents?|videos?|images?|pictures?|backgrounds?|verses?|passages?|items?|text|words|box(?:es)?|lines?)\b/;
const ONLY_SCREEN_PATTERN =
    /\bonly\s+(?:use|work\s+with|show\s+(?:\w+\s+)?on|send\s+(?:\w+\s+)?to|present\s+(?:\w+\s+)?(?:to|on)|go\s+to)\s+(?:the\s+)?screen\b|\b(?:present|send|show|put|go(?:es)?|display)\b.{0,50}?\b(?:screens?|project[eo]rs?|tvs?|monitors?)\s*\d{0,2}\s+only\b|\bscreens?\s+(?:that\s+)?(?:i|we)(?:'m|'re|\s+am|\s+are)?\s+(?:send(?:ing)?|present(?:ing)?)\s+(?:to|on)\b|\b(?:target(?:ing)?|aim(?:ing)?)\s+(?:only\s+|just\s+)?(?:the\s+)?(?:[\w-]+\s+)?(?:screens?|project[eo]rs?|tvs?)\b|\b(?:just|only)\s+(?:the\s+)?(?:screen\s*(?:#\s*)?\d{1,2}|(?:first|second|third|left|right|main|other)\s+screen)\b|\b(?:to|on)\s+(?:the\s+)?(?:[\w-]+\s+)?(?:screens?\s*\d{0,2}|project[eo]rs?|tvs?|monitors?)(?:\s*(?:,|and|&|\+)\s*(?:the\s+)?(?:(?:[\w-]+\s+)?(?:screens?\s*\d{0,2}|project[eo]rs?|tvs?|monitors?)|\d{1,2}))*\s+only\b|\b(?:every|each|all(?:\s+the)?)\s+(?:screens?|project[eo]rs?|tvs?|monitors?)\s+(?:except|but|apart\s+from|other\s+than|besides)\b/;
// On the Presenter, _untick everything_ and _select all_ are the screens'
// ticks; a screen made to receive what is presented is ticked.
const SELECT_ALL_PATTERN =
    /^(?:(?:please|pls|now|ok(?:ay)?|just)\s+)*(?:un-?tick|tick|de-?select|unselect|select|check|uncheck)\s+(?:all|everything|every\s*one|them\s+all|both|none)(?:\s+(?:of\s+them|the\s+screens|screens))?\s*[.!]*$/;
const RECEIVE_PATTERN =
    /\b(?:receiv(?:e|es|ing)|get(?:s|ting)?)\s+(?:what(?:ever)?|everything|all)\s+(?:that\s+)?(?:i|we)\s+(?:present|send|show|put\s+(?:up|on))\b/;

const CLEAR_PATTERN =
    /\b(?:take|clear|remove|get|wipe|blank|empty)\b.*\b(?:off|from)\b.*\bscreens?\s*\d{1,2}\b|\b(?:clear|blank|wipe|empty)\s+(?:screen\s*\d{1,2}|both\s+screens|all\s+(?:the\s+)?screens)\b/;
// A clear ASKED for -- the line opens on it, after a please or a can you --
// naming any screen: _clear everything on both screens_, _blank the second
// screen now_. A line that only SAYS a screen went blank does not.
const CLEAR_LEAD_PATTERN =
    /(?:^|[,.;:!?]\s*|\b(?:and|then|please|pls|plz)\s+)(?:(?:please|pls|plz|kindly|just|now|quick(?:ly)?|hey|ok(?:ay)?|right|so|can\s+you|could\s+you|would\s+you|will\s+you|go\s+ahead\s+and)\s*,?\s+)*(?:clear|wipe|blank|empty|kill|nuke|zap|strip)\s+(?:(?:just|only)\s+)?(?:the|all|both|every|everything|each|it|that|this|those|these|my|our|what(?:'s|\s+is)?|whatever|anything|out|off|up|bg|background|foreground|slides?|lyrics?|songs?|text|verses?|bible|passage|pictures?|images?|videos?|screens?\s*(?:#\s*)?\d{1,2}|project[eo]rs?|tvs?|monitors?)\b/;
// On the Presenter, a layer cleared names the screens' layer: _clear just
// the background layer, keep the verse_ (the blind set C).
const CLEAR_LAYER_PATTERN =
    /(?:^|[,.;:!?]\s*|\b(?:and|then|please|pls|plz)\s+)(?:(?:please|pls|plz|kindly|just|now|quick(?:ly)?|ok(?:ay)?|can\s+you|could\s+you|would\s+you)\s*,?\s+)*(?:clear|wipe|blank|empty|kill)\s+(?:(?:just|only)\s+)?(?:the\s+)?(?:bg|background|foreground|slides?|bible(?:\s+text)?|verses?|passage)(?:\s+layers?)?\b(?!\s+(?:colou?rs?|music|search|history|list|notes?|highlights?|box(?:es)?)\b)/;
const GET_RID_PATTERN =
    /\bget\s+rid\s+of\b|\b(?:clean|clear|wipe|take|get|strip|knock)\s+(?:it|that|this|them|those|these|everything)\s+off\b/;
// Something taken off a screen named any way: _remove the slide from the
// projector_, _take the long text off the left screen_.
const TAKE_OFF_PATTERN =
    /\b(?:take|get|pull|remove|clear|wipe|strip|clean|nuke|knock|kill)\b.{0,60}?\b(?:off|from|out\s+of)\s+(?:of\s+)?(?:the\s+|both\s+|all\s+(?:the\s+)?|every\s+|each\s+|my\s+)?(?:[\w-]+\s+)?(?:screens?|project[eo]rs?|tvs?|televisions?|monitors?)\b/;
// An overlay of the foreground is its own conversation's to take off, and
// a picture OF a screen is a screenshot.
const CLEAR_EXCLUDE_PATTERN =
    /\b(?:countdowns?|clocks?|stopwatch(?:es)?|timers?|marquees?|messages?|announcements?|quick\s+text|screen\s*shots?|snapshots?|(?:pictures?|photos?|images?)\s+of)\b/;

const VERSION_PATTERN =
    /\b(?:versions?|verisons?|vesions?|verions?|translations?)\b/;
const MORE_BIBLES_PATTERN =
    /\b(?:another|a\s+second|second|other|both|two|three|parallel|more|extra)\s+(?:bibles?|versions?|translations?)\b/;
const ADD_BIBLE_PATTERN =
    /\b(?:add|put|show|include|display|bring\s+in)\b.{0,40}\bbible\b(?!\s+(?:text|words|font|looks?|styles?|letters))(?!\S).{0,40}\b(?:to|beside|next\s+to|alongside|with|under|below|above)\b/;
// A Bible named by the short name of a common English edition -- _add the
// NIV next to it_, _swap kjv for niv on screen 1_ (the blind set). Short
// names a sentence uses for other things (web, net, amp, msg) are left out.
const BIBLE_NAME_PATTERN =
    /\b(?:kjv|kjva|akjv|nkjv|niv|nirv|tniv|esv|nasb|nlt|csb|hcsb|rsv|nrsv|nrsvue|asv|ylt|gnt|gnb|cev|ceb|lsb|bsb|leb|nabre|ncv|tlb)\b/;
// What makes a Bible named a change to the passage's versions: added or
// put beside it, taken off, swapped.
const BIBLE_NAME_CHANGE_PATTERN =
    /\b(?:add|include|bring\s+in|throw\s+in|remove|drop|swap|switch|replace|change|get\s+rid\s+of|use|pick|choose|select|want)\b|\btake\b.*\b(?:off|out|away)\b|\b(?:put|show(?!\s+me\b)|display|stick)\b.*\b(?:beside|next\s+to|alongside|along\s+with|with|under|below|above|too|as\s+well|also|both|and|plus|together)\b/;
const BIBLE_NAME_GLOBAL_PATTERN = new RegExp(BIBLE_NAME_PATTERN.source, 'g');
// Two Bibles named together: _esv and nlt together on both screens_.
const BIBLE_PAIR_PATTERN =
    /\b(?:and|with|plus|together|both|beside|alongside|next\s+to)\b|[&+]/;
// A Bible named while a verse is looked for is the verse finder's.
const BIBLE_NAME_EXCLUDE_PATTERN =
    /\b(?:find|search(?:ing)?|look(?:ing)?\s+(?:up|for)|which\s+verse|where\s+(?:is|does)|remember|differences?|better|best|more\s+accurate|accura(?:te|cy)|recommend(?:ed)?|reliable|literal|translated\s+from|history)\b/;
const VERSION_CHANGE_PATTERN =
    /\b(?:add|include|remove|take|drop|hide|swap|switch|replace|change|just|only|keep|get\s+rid\s+of|bring\s+in|put|stick|place|beside|next\s+to|alongside|together)\b/;
// A Bible to get, a list to keep verses in, the app's own version, or a
// document's translation: none of them the passage on a screen.
const VERSION_EXCLUDE_PATTERN =
    /\b(?:download(?:ed|ing|s)?|install(?:ed|ing|s)?|import(?:ed|ing|s)?|updat(?:e|ed|es|ing)|delet(?:e|ed|es|ing)|uninstall(?:ed|ing|s)?|buy|list|app|latest|newest|songs?|lyrics?|slides?|notes?|study|document|chat|computer|laptop|device|library|settings|menus?|buttons?|interface|labels?)\b/;
const BIBLE_CONTEXT_PATTERN = /\b(?:bible|verses?|passages?|scriptures?)\b/;

const COLOR_WORD_SOURCE =
    'red|orange|yellow|gold(?:en)?|green|blue|navy|purple|violet|pink|' +
    'white|black|grey|gray|silver|cream|brown|cyan|aqua|lime|teal|maroon';
// A colour is a look only where a change puts it -- _make it yellow_, _in
// white_ -- never in a verse's own words (_the Red Sea_, _white as snow_).
const COLOR_LOOK_PATTERN = new RegExp(
    '\\b(?:make|turn|change|set|paint|colou?r|use|in|to|into|' +
        '(?:should|must|needs?\\s+to)\\s+be|' +
        '(?:can|could|would)\\s+(?:\\S+\\s+){1,3}?be)\\s+' +
        `(?:\\S+\\s+){0,6}?(?:${COLOR_WORD_SOURCE})\\b`,
);
const LOOK_PATTERN = new RegExp(
    '\\b(?:bigger|larger|smaller|tinier|huge|tiny|font\\s*size|text\\s*size|' +
        'size|colou?r(?:ed|s)?|bold(?:er)?|unbold|' +
        'italics?|shadows?|outlined?|outlines|stroke|glow(?:ing)?|' +
        'align(?:ed|ment)?|cent(?:er|re)d?|justif(?:y|ied)|' +
        'line\\s*(?:height|spacing)|spacing|closer\\s+together|' +
        '(?:more|less|extra)\\s+(?:space|room|gaps?)\\s+(?:between|around)|' +
        '(?:further|farther|far)\\s+apart|spaced|margins?|padding|' +
        'spread\\s+(?:out|apart)|tighter|' +
        'looser|letter\\s*spacing|styles?|styled|backdrop|readable|font|' +
        'cramm?ed|cramped|squashed|squished|squeezed|bunched|' +
        'space\\s+(?:\\S+\\s+){0,3}?out|' +
        'typeface|serif|sans|uppercase|capitals|reset|' +
        'back\\s+to\\s+(?:normal|the\\s+default|default)|' +
        '(?:default|normal|original)\\s+(?:style|look|size|font)|' +
        'too\\s+(?:small|big|large|tiny|faint|dark|light|bright|close|' +
        "tight|thin)|(?:can'?t|cannot)\\s+(?:read|see)|" +
        'hard\\s+to\\s+(?:read|see)|easier\\s+to\\s+(?:read|see))\\b',
);
const BIBLE_TEXT_PATTERN =
    /\b(?:bible|verses?|scriptures?|passages?|long\s+text)\b/;
const TEXT_PATTERN = /\b(?:text|words|letters|font|lettering|writing)\b/;
// Looks only text has, read with a screen named and no word for the text:
// _increase line spacing a bit on screen 2_ (the blind set C).
const TEXT_LOOK_PATTERN =
    /\b(?:font\s*size|text\s*size|line\s*(?:height|spacing)|letter\s*spacing|spacing|bold(?:er)?|unbold|italics?|typeface|serif|sans|uppercase|capitals)\b/;
// The room failing to read what the screens show: _the back row can't read
// it_ (the blind set C).
const READING_PATTERN =
    /\b(?:can'?t|cannot|can\s+not|unable\s+to|struggl(?:e|es|ing)\s+to|hard\s+to|difficult\s+to)\s+(?:read|see)\b|\btoo\s+(?:small|tiny|faint|blurry)\b|\b(?:un)?readable\b/;
// The room reading it: on the Presenter, text _people can't read_ is what
// the screens show (2026-11-14, the blind set: _people can't read the white
// text, make it darker_).
const AUDIENCE_PATTERN =
    /\b(?:people|congregation|audience|everyone|everybody|folks|church|elderly|older\s+(?:people|folks|members)|(?:the\s+)?back\s+rows?|(?:from|at)\s+the\s+back)\b/;
// Words of another thing's look: a note, a document, a foreground extra,
// the app's own window -- each changed in its own conversation.
// A verse looked for is the verse finder's.
const STYLE_EXCLUDE_PATTERN =
    /\b(?:notes?|highlight(?:ed|s|ing)?|study|studies|slides?|songs?|lyrics?|marquees?|countdowns?|stopwatch(?:es)?|clocks?|timers?|messages?|quick\s+text|reader|lookups?|documents?|chats?|window|apps?|menus?|buttons?|panels?|editors?|presenter|find|search|look(?:ing)?\s+(?:up|for))\b/;

// A screen ADDED -- the Mini Screen panel's ⋮ menu, Add New Screen
// (2026-11-14, EC-630): _add a new screen_, _I need another screen_,
// _create a second output screen_, _new screen please_. A word that adds
// one stands right before how many: add, create and set up before any
// (_add a screen_); need, want and give me only before more than there is
// (_I need a screen to show the lyrics_ may be one there is); make only
// before a new one (_make another screen show the verse_ changes one there
// is). Between that and the screen's word, at most two of a closed set:
// never _a green screen_, a blank one or a welcome one, things to show.
const NEW_SCREEN_ANY_SOURCE =
    '(?:a|an|one|1|2|3|two|three|another|one\\s+more|some\\s+more|' +
    'a\\s+new|new|a\\s+second|a\\s+third|a\\s+fourth|an\\s+extra|extra|' +
    'an\\s+additional|additional|more|a\\s+separate|a\\s+further)';
const NEW_SCREEN_MORE_SOURCE =
    '(?:2|3|two|three|another|one\\s+more|some\\s+more|a\\s+new|new|' +
    'a\\s+second|a\\s+third|a\\s+fourth|an\\s+extra|extra|' +
    'an\\s+additional|additional|more|a\\s+separate|a\\s+further)';
const NEW_SCREEN_MAKE_SOURCE =
    '(?:a\\s+new|new|one\\s+more|an\\s+extra|an\\s+additional|another\\s+new)';
const NEW_SCREEN_NOUN_SOURCE =
    '(?:(?:new|extra|additional|more|second|third|fourth|separate|' +
    'output|presentation|projector|mini)\\s+){0,2}' +
    '(?:screens?|mini\\s*screens?|outputs?)\\b' +
    // Never a thing a screen has -- _a new screen layout_, _another screen
    // saver_ -- nor the menu's own control named (_the add new screen
    // button does nothing_), nor a screen made to do something: _make
    // another screen show the verse_.
    '(?!\\s*-?\\s*(?:savers?|shots?|recordings?|recorders?|captures?|' +
    'readers?|time|mirror(?:ing)?|shar(?:e|ing)|names?|layouts?|sizes?|' +
    'resolutions?|brightness|colou?rs?|modes?|settings?|locks?|' +
    'keyboards?|protectors?|folders?|files?|paths?|devices?|formats?|' +
    'languages?|volume|levels?|ports?|cables?|buttons?|menus?|items?|' +
    'options?|entr(?:y|ies)|commands?|icons?|tabs?|links?)\\b)' +
    '(?!\\s+(?:show|shows|display|displays|mirror|mirrors|match|matches|' +
    'follow|follows|copy|copies|be|look|looks|say|says|read|reads)\\b)';
const NEW_SCREEN_PATTERN = new RegExp(
    `\\b(?:add|create|set\\s+up)\\s+${NEW_SCREEN_ANY_SOURCE}\\s+` +
        `${NEW_SCREEN_NOUN_SOURCE}|` +
        '\\b(?:need|want|give\\s+(?:me|us)|get\\s+(?:me|us)|' +
        "(?:i|we)'?d\\s+like|(?:i|we)\\s+would\\s+like)\\s+" +
        `${NEW_SCREEN_MORE_SOURCE}\\s+${NEW_SCREEN_NOUN_SOURCE}|` +
        `\\bmake\\s+${NEW_SCREEN_MAKE_SOURCE}\\s+${NEW_SCREEN_NOUN_SOURCE}`,
);
// The menu's own words, or fewer, as the whole line: _add screen_, _new
// screen_, _a new screen please_.
const NEW_SCREEN_LINE_PATTERN =
    /^(?:(?:please|pls|plz|ok(?:ay)?|now|just|can\s+you|could\s+you|would\s+you|will\s+you)\s*,?\s+)*(?:add(?:\s+a)?(?:\s+new)?|(?:a\s+)?new)\s+(?:mini\s*)?screen(?:\s+(?:please|pls|plz|now|for\s+me))?\s*[.!?]*$/;
// A virtual display is the Virtual Screens Manager's, and a screen a phone,
// a browser or a stream watches is Screen Mirror's; a how-to is the
// guide's. _Another screen to the group_, or two screens showing the same,
// is a screen there is -- unless the line says it is new.
const NEW_SCREEN_EXCLUDE_PATTERN =
    /\b(?:virtual|mirror(?:s|ed|ing)?|cast(?:s|ing)?|chromecast|airplay|phones?|tablets?|ipads?|browsers?|web\s*(?:pages?|sites?)|websites?|network|wi-?fi|stream(?:s|ing)?|livestream(?:s|ing)?|obs|youtube|facebook|zoom\s+(?:meeting|call|link|app|session|room)s?)\b|\bhow\s+(?:to|do|does|can|could|would)\b/;
const NEW_SCREEN_GROUP_JOIN_PATTERN =
    /\b(?:to|into|in)\s+(?:the|a|that|this|its|their|our|same|one)\s+(?:[\w-]+\s+)?group\b/;

function checkIsNewScreenAsk(line: string) {
    if (
        !(
            NEW_SCREEN_PATTERN.test(line) || NEW_SCREEN_LINE_PATTERN.test(line)
        ) ||
        NEW_SCREEN_EXCLUDE_PATTERN.test(line)
    ) {
        return false;
    }
    return (
        /\bnew\b/.test(line) ||
        !(
            NEW_SCREEN_GROUP_JOIN_PATTERN.test(line) ||
            SAME_AS_PATTERN.test(line)
        )
    );
}

/**
 * The screen control a typed line asks about, in English -- English is the
 * one language read in code; a line under a screen answer stays in the
 * conversation in any language (`checkIsScreenThread`). Null for a line that
 * is not one, a how-to (the guide's), and a `/` command.
 *
 * `focus` is the window the tab asks about: in the Reader and the editor,
 * "make the Bible text bigger" is the page's own text, and only a line that
 * names a screen is the screens'.
 */
export function readScreenControlAsk(
    text: string,
    focus: string | null = 'presenter',
): ScreenAskKindType | null {
    const line = toReadAskLine(toAskLine(text));
    if (
        line === '' ||
        line.startsWith('/') ||
        HOW_TO_PATTERN.test(line) ||
        HOW_TO_INNER_PATTERN.test(line) ||
        WHAT_DOES_PATTERN.test(line)
    ) {
        return null;
    }
    const screenLine = line.replace(/^display\b/, '');
    const isScreenNamed =
        SCREEN_PATTERN.test(screenLine) || NUMBERED_SCREEN_PATTERN.test(line);
    // A line about the Reader names the Reader's own page: _open ESV and
    // NKJV side by side in the reader_ (the blind set D).
    if (READER_PAGE_PATTERN.test(line) && !isScreenNamed) {
        return null;
    }
    // A screen called by its role is a screen, never the display it is on.
    const roleLine = screenLine.replace(SCREEN_ROLE_NAME_PATTERN, ' screen ');
    const isNumbered =
        NUMBERED_SCREEN_PATTERN.test(line) || ALL_SCREENS_PATTERN.test(line);
    const isTwoScreens =
        ALL_SCREENS_PATTERN.test(line) ||
        (line.match(SCREEN_WORD_GLOBAL_PATTERN) ?? []).length >= 2;
    const bibleNameCount = new Set(line.match(BIBLE_NAME_GLOBAL_PATTERN) ?? [])
        .size;
    const isPresenter = focus === 'presenter';
    // A screen added is asked for before what is done with it: _I need
    // another screen for the stage_, _add a screen with a fade_.
    if (checkIsNewScreenAsk(line)) {
        return 'newScreen';
    }
    // A song's or an editor's own transition is not a screen's, unless a
    // screen is named; a foreground extra's Effects are its panel's.
    const isOtherTransition =
        TRANSITION_EXCLUDE_PATTERN.test(line) && !isScreenNamed;
    const isWidgetEffect = FOREGROUND_WORD_PATTERN.test(line);
    if (
        (TRANSITION_PATTERN.test(line) && !isOtherTransition) ||
        (EFFECT_TRANSITION_PATTERN.test(line) &&
            !isOtherTransition &&
            !isWidgetEffect) ||
        (((EFFECT_WORD_PATTERN.test(line) &&
            (LAYER_WORD_PATTERN.test(line) || isScreenNamed)) ||
            NAMED_EFFECT_PATTERN.test(line) ||
            ABRUPT_CHANGE_PATTERN.test(line)) &&
            !EFFECT_EXCLUDE_PATTERN.test(line) &&
            !isOtherTransition &&
            !isWidgetEffect)
    ) {
        return 'transition';
    }
    const isVersionsNamed =
        VERSION_WORD_PATTERN.test(line) || bibleNameCount >= 2;
    if (
        LINE_SYNC_PATTERN.test(line) ||
        ((LINE_UP_PATTERN.test(line) || SYNC_WORD_PATTERN.test(line)) &&
            isVersionsNamed) ||
        (OUT_OF_STEP_PATTERN.test(line) && bibleNameCount >= 2)
    ) {
        return 'lineSync';
    }
    // "The stage screen" names a screen; a stage is the number it shows.
    const stageLine = line.replace(STAGE_SCREEN_NAME_PATTERN, ' ');
    if (
        (STAGE_NUMBER_PATTERN.test(stageLine) && isScreenNamed) ||
        STAGE_ROLE_PATTERN.test(line)
    ) {
        return 'stage';
    }
    if (
        (DISPLAY_NOUN_PATTERN.test(roleLine) ||
            DISPLAY_MOVE_PATTERN.test(roleLine) ||
            DISPLAY_WRONG_PATTERN.test(line) ||
            (DISPLAY_OUTPUT_PATTERN.test(line) && isScreenNamed)) &&
        !DISPLAY_EXCLUDE_PATTERN.test(line)
    ) {
        return 'display';
    }
    if (
        isScreenNamed &&
        ((GROUP_PATTERN.test(line) && !PEOPLE_GROUP_PATTERN.test(line)) ||
            UNLINK_PATTERN.test(line) ||
            ((SAME_AS_PATTERN.test(line) ||
                (isTwoScreens &&
                    (LINK_SCREENS_PATTERN.test(line) ||
                        SYNC_WORD_PATTERN.test(line)))) &&
                !SAME_AS_EXCLUDE_PATTERN.test(line)))
    ) {
        return 'group';
    }
    if (
        (LOCK_PATTERN.test(line) &&
            (isScreenNamed || (isPresenter && LOCK_ALL_PATTERN.test(line)))) ||
        (LOCK_WORD_PATTERN.test(line) && isScreenNamed)
    ) {
        return 'lock';
    }
    if (
        STAGE_PATTERN.test(stageLine) &&
        (SCREEN_PATTERN.test(stageLine) ||
            NUMBERED_SCREEN_PATTERN.test(stageLine))
    ) {
        return 'stage';
    }
    const isScreenBibleNamed =
        isScreenNamed || (isPresenter && BIBLE_CONTEXT_PATTERN.test(line));
    if (
        bibleNameCount > 0 &&
        (BIBLE_NAME_CHANGE_PATTERN.test(line) ||
            (bibleNameCount >= 2 && BIBLE_PAIR_PATTERN.test(line))) &&
        !VERSION_EXCLUDE_PATTERN.test(line) &&
        !BIBLE_NAME_EXCLUDE_PATTERN.test(line) &&
        (isScreenNamed || isPresenter)
    ) {
        return 'versions';
    }
    if (
        (SELECT_PATTERN.test(line) &&
            (isNumbered || isScreenNamed) &&
            !SELECT_EXCLUDE_PATTERN.test(line)) ||
        (isPresenter && SELECT_ALL_PATTERN.test(line)) ||
        (isScreenNamed && RECEIVE_PATTERN.test(line))
    ) {
        return 'select';
    }
    if (
        CLEAR_PATTERN.test(line) ||
        ((((CLEAR_LEAD_PATTERN.test(line) || GET_RID_PATTERN.test(line)) &&
            isScreenNamed) ||
            (isPresenter && CLEAR_LAYER_PATTERN.test(line)) ||
            TAKE_OFF_PATTERN.test(line)) &&
            !CLEAR_EXCLUDE_PATTERN.test(line))
    ) {
        return 'clear';
    }
    // _Only screen 1_, _to the tv only_: what is presented goes there.
    if (ONLY_SCREEN_PATTERN.test(line)) {
        return 'select';
    }
    if (
        (((VERSION_PATTERN.test(line) ||
            MORE_BIBLES_PATTERN.test(line) ||
            ADD_BIBLE_PATTERN.test(line)) &&
            isScreenBibleNamed) ||
            (VERSION_PATTERN.test(line) &&
                VERSION_CHANGE_PATTERN.test(line) &&
                isPresenter)) &&
        !VERSION_EXCLUDE_PATTERN.test(line)
    ) {
        return 'versions';
    }
    if (
        (LOOK_PATTERN.test(line) || COLOR_LOOK_PATTERN.test(line)) &&
        !STYLE_EXCLUDE_PATTERN.test(line) &&
        ((BIBLE_TEXT_PATTERN.test(line) && (isScreenNamed || isPresenter)) ||
            (TEXT_PATTERN.test(line) &&
                (isScreenNamed ||
                    (isPresenter && AUDIENCE_PATTERN.test(line)))) ||
            (TEXT_LOOK_PATTERN.test(line) && isScreenNamed) ||
            (isPresenter &&
                AUDIENCE_PATTERN.test(line) &&
                READING_PATTERN.test(line)))
    ) {
        return 'style';
    }
    return null;
}

// --- the thread ---------------------------------------------------------------

type ScreenMessageType = {
    author: 'you' | 'bot';
    isFollowUp?: true;
    isScreenAnswer?: true;
    actions?: { toolName?: string; args?: any }[];
};

function findLastAnswer(messages: readonly ScreenMessageType[]) {
    return [...messages].reverse().find((message) => {
        return message.author === 'bot' && message.isFollowUp !== true;
    });
}

/**
 * Whether a plain line typed in the tab is more of a screen conversation:
 * the last answer was one, and the line is not a command. A sentence the
 * window wrote under it (the Undo's) is not an answer.
 */
export function checkIsScreenThread(
    messages: readonly ScreenMessageType[],
    text: string,
) {
    const line = String(text ?? '').trim();
    if (line === '' || line.startsWith('/')) {
        return false;
    }
    return findLastAnswer(messages)?.isScreenAnswer === true;
}

/**
 * The undo ids of the last screen answer's change, newest first: what
 * "undo that" typed under it takes back. Empty when that answer changed
 * nothing.
 */
export function findScreenUndoIds(messages: readonly ScreenMessageType[]) {
    const lastAnswer = findLastAnswer(messages);
    if (lastAnswer?.isScreenAnswer !== true) {
        return [];
    }
    const undoAction = (lastAnswer.actions ?? []).find((action) => {
        return (
            action.toolName === LYRIC_UNDO_TOOL_NAME &&
            action.args?.kind === SCREEN_UNDO_KIND
        );
    });
    if (undoAction === undefined) {
        return [];
    }
    const idList = Array.isArray(undoAction.args?.ids)
        ? (undoAction.args.ids as unknown[])
        : [undoAction.args?.id];
    return idList
        .filter((id): id is string => {
            return typeof id === 'string' && /^[\w.-]{1,80}$/.test(id);
        })
        .reverse();
}

// --- the screens, read for the ask ----------------------------------------

type ScreenReadScreenType = {
    id?: unknown;
    on?: unknown;
    ticked?: unknown;
    locked?: unknown;
    group?: unknown;
    groupWith?: unknown;
    stage?: unknown;
    display?: unknown;
    transition?: unknown;
    lineSync?: unknown;
    bible?: { reference?: unknown; versions?: unknown } | null;
    slide?: unknown;
    background?: unknown;
    foreground?: unknown;
};

function toWord(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim().slice(0, 160)
        : fallback;
}

function toWordList(value: unknown) {
    return (Array.isArray(value) ? value : [])
        .filter((one): one is string | number => {
            return typeof one === 'string' || typeof one === 'number';
        })
        .map((one) => {
            return String(one).slice(0, 80);
        });
}

function toScreenLine(screen: ScreenReadScreenType) {
    const parts = [
        screen.on === true ? 'ON (the room sees it)' : 'off',
        screen.ticked === true ? 'ticked' : 'not ticked',
    ];
    if (screen.locked === true) {
        parts.push('locked');
    }
    if (typeof screen.group === 'string' && screen.group !== '') {
        const withList = toWordList(screen.groupWith);
        parts.push(
            `in the ${screen.group} group` +
                (withList.length > 0
                    ? ` with screen ${withList.join(' and ')}`
                    : ''),
        );
    }
    parts.push(`stage ${Number(screen.stage) || 0}`);
    parts.push(`display ${toWord(screen.display, 'none')}`);
    const transition = (screen.transition ?? {}) as Record<string, unknown>;
    parts.push(
        'transitions: ' +
            ['slide', 'background', 'foreground']
                .map((layer) => {
                    return `${layer} ${toWord(transition[layer], 'fade')}`;
                })
                .join(', '),
    );
    parts.push(`Line Sync ${screen.lineSync === true ? 'on' : 'off'}`);
    const shows: string[] = [];
    if (screen.bible !== null && typeof screen.bible === 'object') {
        const versions = toWordList(screen.bible.versions);
        shows.push(
            `the Bible, ${toWord(screen.bible.reference, 'a passage')}` +
                (versions.length > 0 ? ` in ${versions.join(' + ')}` : ''),
        );
    }
    if (typeof screen.slide === 'string' && screen.slide !== '') {
        shows.push(screen.slide.slice(0, 160));
    }
    if (typeof screen.background === 'string' && screen.background !== '') {
        shows.push(`background ${screen.background.slice(0, 120)}`);
    }
    const foreground = toWordList(screen.foreground);
    if (foreground.length > 0) {
        shows.push(`foreground ${foreground.join(', ')}`);
    }
    return (
        `Screen ${toWord(String(screen.id ?? ''), '?')}: ${parts.join(', ')}. ` +
        `Shows: ${shows.length > 0 ? shows.join('; ') : 'nothing'}.`
    );
}

/**
 * What `owa_screen_edit read` said, as plain lines under the question; null
 * when it said nothing usable. Off the Presenter page it says where to go.
 */
export function toScreenReadText(result: unknown): string | null {
    if (result === null || typeof result !== 'object') {
        return null;
    }
    const read = result as Record<string, unknown>;
    if (typeof read.needsPage === 'string') {
        return (
            'The main window is not on the Presenter page, where the ' +
            'screens are: switch it there first (owa_goto_page ' +
            'presenter.html), then read them (owa_screen_edit read).'
        );
    }
    if (!Array.isArray(read.screens)) {
        return null;
    }
    const lines: string[] = [];
    if (read.screens.length === 0) {
        lines.push('No screen is set up yet.');
    }
    for (const screen of read.screens.slice(0, MAX_READ_SCREENS)) {
        lines.push(toScreenLine((screen ?? {}) as ScreenReadScreenType));
    }
    if (typeof read.bibleStyle === 'string') {
        lines.push(
            `The Bible text style, one for every screen: ${read.bibleStyle}.`,
        );
    }
    const displays = (Array.isArray(read.displays) ? read.displays : [])
        .map((display: any) => {
            return (
                `${toWord(display?.name, 'a display')} (id ${display?.id}` +
                (display?.size ? `, ${display.size}` : '') +
                (display?.primary === true ? ', primary' : '') +
                (display?.virtual === true ? ', virtual' : '') +
                ')'
            );
        })
        .slice(0, 8);
    if (displays.length > 0) {
        lines.push(`Displays: ${displays.join('; ')}.`);
    }
    const bibles = toWordList(read.bibles).slice(0, 12);
    if (bibles.length > 0) {
        lines.push(`Bibles installed: ${bibles.join('; ')}.`);
    }
    const looks = toWordList(read.looks);
    if (looks.length > 0) {
        lines.push(`Text looks: ${looks.join(', ')}.`);
    }
    const colors = toWordList(read.groupColors);
    if (colors.length > 0) {
        lines.push(`Group colours: ${colors.join(', ')}.`);
    }
    const text = lines.join('\n');
    return text.length > MAX_SCREEN_READ_CHARS
        ? `${text.slice(0, MAX_SCREEN_READ_CHARS - 3)}...`
        : text;
}

// Said to the model when the line under a screen answer was sent with no
// words: the screens as they are, and what can be changed.
const SCREEN_WORDLESS_HINT =
    '(They sent no words: say in a sentence what the screens show and ' +
    'offer two or three changes.)';

/**
 * What the model is asked: their question, the screens as read just now,
 * and -- under a change -- the id that takes it back, for an "undo that".
 * In the USER turn, never the system prompt, which is a cached prefix.
 */
export function toScreenAsk(
    asked: string,
    readText: string | null,
    undoIds: readonly string[] = [],
) {
    const parts = [asked.trim() === '' ? SCREEN_WORDLESS_HINT : asked];
    parts.push(
        readText === null
            ? '(The screens could not be read just now: read them with ' +
                  'owa_screen_edit read before changing anything.)'
            : `The screens as they are now, read just now:\n${readText}`,
    );
    if (undoIds.length > 0) {
        parts.push(
            'The last change in this conversation is taken back with ' +
                'owa_undo action "undo", ' +
                (undoIds.length === 1
                    ? `id "${undoIds[0]}"`
                    : `ids ${undoIds
                          .map((id) => {
                              return `"${id}"`;
                          })
                          .join(', ')}, one call each in that order`) +
                ' -- only when they ask to undo it, and never write an id in ' +
                'the answer.',
        );
    }
    return parts.join('\n\n');
}

// --- the change it made -------------------------------------------------------

const UNDO_ID_SENTENCE_PATTERN = /\bowa_undo id "([\w.-]{1,80})"/;

/**
 * A change `owa_screen_edit` made, off its RESULT: a read, an "already so"
 * and a refusal changed nothing. A change stopped half way still carries the
 * id that takes back what was done, in its sentence. Never a document: no
 * **Show it in the list** goes under it (`checkIsScreenEdited`).
 */
export function readEditedScreen(text: string): EditedLyricType | null {
    let undoId: string | null = null;
    try {
        const result = JSON.parse(text);
        if (
            typeof result?.undoId === 'string' &&
            result.undoId !== '' &&
            typeof result.did === 'string'
        ) {
            undoId = result.undoId;
        }
    } catch (_error) {
        undoId = UNDO_ID_SENTENCE_PATTERN.exec(String(text ?? ''))?.[1] ?? null;
    }
    // A screen added is a change even when no Undo could be kept for it
    // (EC-630): the answer may say it was added, and no Undo is offered.
    if (undoId === null && readAddedScreenId(text) === null) {
        return null;
    }
    return {
        name: SCREEN_EDITED_NAME,
        undoId,
        listName: SCREEN_EDITED_LIST_NAME,
        // What an answer that stopped before saying names, in the person's
        // language: never the English key.
        shownName: tran('Screens'),
    };
}

/**
 * The number of the screen an `owa_screen_edit` `newScreen` call added, off
 * its answer (EC-630); null for any other answer.
 */
export function readAddedScreenId(text: string): number | null {
    try {
        const result = JSON.parse(text);
        return typeof result?.did === 'string' &&
            Number.isInteger(result.newScreen) &&
            result.newScreen >= 0
            ? result.newScreen
            : null;
    } catch (_error) {
        return null;
    }
}

/** Whether an edit on the watch is the screens'. */
export function checkIsScreenEdited(edited: EditedLyricType | null) {
    return edited?.listName === SCREEN_EDITED_LIST_NAME;
}

/**
 * Every change ONE answer made to the screens, under its one Undo: a size
 * changed and then a colour are two calls, and the press takes back both.
 */
export function mergeEditedScreen(
    previous: EditedLyricType | null,
    next: EditedLyricType,
): EditedLyricType {
    if (previous === null || !checkIsScreenEdited(previous)) {
        return next;
    }
    const undoIdList = [
        ...new Set([
            ...(previous.undoIdList ??
                (previous.undoId === null ? [] : [previous.undoId])),
            ...(next.undoId === null ? [] : [next.undoId]),
        ]),
    ];
    return {
        ...next,
        // The newest change kept no Undo (a screen added, EC-630): the press
        // still takes back the ones before it.
        undoId: next.undoId ?? undoIdList[undoIdList.length - 1] ?? null,
        ...(undoIdList.length > 1 ? { undoIdList } : {}),
    };
}

/**
 * **Undo this change** under a screen answer: the song's press, read by the
 * same handler, which says its own sentence for `kind: 'screen'`.
 */
export function genScreenUndoAction(edited: EditedLyricType) {
    if (edited.undoId === null) {
        return null;
    }
    return {
        label: LYRIC_UNDO_LABEL,
        toolName: LYRIC_UNDO_TOOL_NAME,
        args: {
            id: edited.undoId,
            name: edited.name,
            kind: SCREEN_UNDO_KIND,
            ...(edited.undoIdList === undefined
                ? {}
                : { ids: edited.undoIdList }),
        },
    };
}

/**
 * A screen answer's own claims of a change, beside the foreground's and a
 * note's (`checkHasForegroundClaim`): first person only -- "screen 0 is
 * locked" is what a read says too.
 */
export const SCREEN_CLAIM_PATTERN =
    /\bI(?:'ve|\u2019ve| have) (?:locked|unlocked|grouped|ungrouped|selected|deselected|switched|applied|increased|decreased|reduced|aligned|lined|synced|cleared|moved|enlarged|added|created|undone)\b|\bI (?:locked|unlocked|grouped|ungrouped|selected|deselected|switched|applied|increased|decreased|reduced|aligned|lined|synced|added|created|undid)\b/i;

// --- the prompt ---------------------------------------------------------------

/**
 * The system prompt of such a conversation: what each control does, what
 * the tool takes, and that the room sees what changes.
 */
export const SCREEN_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer control the SCREENS -- the ' +
    'outputs the congregation sees (a projector, a TV, a virtual display ' +
    'watched over the network), each a numbered Mini Screen card in the ' +
    'Presenter. The screens as they are now are given under their ' +
    'message, read just now: do not read them again unless it says ' +
    'they could not be read. ' +
    `Change them with ${SCREEN_EDIT_TOOL_NAME} action "set", ALL of one ` +
    'change in ONE call: `style` is the Bible text look, one for every ' +
    'screen, ONE object (size ' +
    '"larger"/"smaller"/px/"default", color, bold, italic, shadow, outline ' +
    'and outlineColor, glow, look, align, lineHeight and letterSpacing ' +
    '"tighter"/"looser", font, backdrop, highlight, reset) -- a slide\'s or ' +
    "a song's words are their own document's, never this; `versions` " +
    '{add, remove} the Bibles of the passage on a screen, by key, title or ' +
    'language, `lineSync` lines them up verse by verse; `transition` for ' +
    'slide, background or foreground: none, fade, move or zoom; `display` ' +
    'moves a screen to a display by name or id (a virtual one shows on no ' +
    'monitor here); `group` puts the screens named in one group -- grouped ' +
    'screens show the same -- or false takes them out; `lock` keeps a ' +
    'screen from changing; `select` picks the screens new content goes to; ' +
    '`stage`; `show` turns a screen on or off ONLY when they asked for ' +
    'exactly that -- a screen is never turned on unasked: offer it; ' +
    '`clear` takes content off. `newScreen` true, ALONE in its call and ' +
    'only when they ask for a new screen, adds one as the Mini Screen ' +
    "menu's Add New Screen does: off and not ticked, its number in the " +
    'answer -- change it in the next call by that number; only a person ' +
    "removes a screen (Delete in its card's menu). " +
    '`screens`: the numbers they named, else ' +
    'leave it out for the ticked ones. A complaint is an ask ("too small ' +
    'for the back" is larger). A question only about what is on, which ' +
    'display or which transition is answered from the read, no call. To ' +
    'put a verse up use owa_present_bible, then add versions to it. Off ' +
    'the Presenter page, owa_goto_page presenter.html first. Asked HOW to ' +
    'do it themselves, answer with the steps from the guide ' +
    '(owa_help_search) and offer to do it. When they ask to undo the last ' +
    'change, call owa_undo action "undo" with the id given under their ' +
    'message. When the ' +
    'tool refuses, read its reason, fix the call and try once more; then ' +
    'say plainly what went wrong. After a change, say in a sentence or two ' +
    'what changed (only what the answer says changed); ONLY when an ' +
    `${SCREEN_EDIT_TOOL_NAME} answer carries an undoId, say in your own ` +
    'words, in the language you answer in, that the button under the ' +
    'answer puts it back -- field names are not buttons; an owa_undo has ' +
    'no button: say what is back as it was. Never write an id or JSON in ' +
    "your answer. End with ONE line 'OPTIONS: a | b | c' -- two or three " +
    'short next changes they might want, on that one line, never as a list.';
