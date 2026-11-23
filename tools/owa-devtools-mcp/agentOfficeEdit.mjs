// `owa_office_edit`: one of the user's PowerPoint (.pptx) or Word (.docx)
// files read line by line and changed by the help window's assistant
// (2026-11-20, the user: _open pptx or docx in chatbot then interact to edit
// the powerpoint_, _able to undo_, the goal _chatbot smart enough to help
// editor the pptx and docx file_).
//
// The rules are the app's (`src/ms-office/officePackageEditHelpers.ts`,
// pure, and the worker `src/helper/agentOfficeEditHelpers.ts`): the file is
// read as lines with ids, every change is worked out on what was read, and
// the whole batch is ONE write and ONE backup -- the file has no Save here,
// so the backup (a copy of the whole file) is its whole undo. A line's
// words change in the run that holds them, so a bold word, a colour or a
// picture beside it stays as it was. Since the same day the LOOK changes
// too (`officeXmlLookHelpers.ts`): the words' colour, highlight, size,
// bold, italic, underline, face and alignment on a line, a slide's lines or
// every line, a slide's background, a slide hidden in the show -- asked for
// after _change color to green_ was answered "that must be done directly
// in PowerPoint", with the goal _chatbot can change do everything on a
// given pptx_.
//
// Offered to the chatbot's model only in a conversation about an attached
// PowerPoint or Word file (`MODEL_ON_ASK_TOOL_MAP`, kind `office`), where the
// window puts the attached file's own path in `file`
// (`src/chatbot/officeChatHelpers.ts`): a model names the file, never a
// path. An outside agent over stdio may give a whole path; the app checks it
// again at the disk.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp } from './cdp.mjs';
import { genAgentDataExpression } from './agentData.mjs';
import { checkAgentFileName } from './agentFileName.mjs';

export const OFFICE_EDIT_TOOL_NAME = 'owa_office_edit';

export const OFFICE_EDIT_ACTIONS = ['read', 'edit'];

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const OFFICE_EXTENSION_PATTERN = /\.(?:pptx|docx)$/i;

const ONLY_OFFICE_REASON =
  'Only a PowerPoint (.pptx) or Word (.docx) file can be read or changed ' +
  'here.';

/**
 * What `file` names: `{filePath, name}` for a whole path, `{name}` for a
 * file of the Documents folder, or `{reason}` when it is neither.
 */
export function toOfficeEditTarget(file) {
  const text = typeof file === 'string' ? file.trim() : '';
  if (text === '') {
    return {
      reason:
        'Name the file (`file`): as it is attached, or as it reads in ' +
        'the Documents list, with .pptx or .docx.',
    };
  }
  if (!OFFICE_EXTENSION_PATTERN.test(text)) {
    return { reason: ONLY_OFFICE_REASON };
  }
  if (ABSOLUTE_PATH_PATTERN.test(text)) {
    if (
      text.split(/[\\/]/).some((part) => {
        return part === '..';
      })
    ) {
      return {
        reason: 'A file path may not step out of its folder with "..".',
      };
    }
    return { filePath: text, name: text.split(/[\\/]/).pop() ?? '' };
  }
  const nameReason = checkAgentFileName(text);
  return nameReason === null ? { name: text } : { reason: nameReason };
}

export { checkIsOfficeRemoval } from './agentOfficeRemoval.mjs';

async function runOfficeWorker(request, page) {
  const { value } = await evaluateInApp(
    genAgentDataExpression('office-edit', request),
    { match: page },
  );
  if (value === null || typeof value !== 'object') {
    return { isError: true, reason: 'The app did not answer.' };
  }
  return value;
}

function toTextResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function toErrorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: String(error?.message ?? error) }],
  };
}

export const OFFICE_EDIT_DESCRIPTION =
  "Read or change the user's PowerPoint (.pptx) or Word (.docx) file. " +
  '`file`: as attached. `read` lists its lines: {id, text}, a slide ' +
  "line's `box`, a Word line's `style`, a slide's `note` and `boxes` " +
  '(name, kind, `at` [x, y, width, height] in % of the slide, `fills`: it ' +
  "covers the slide and its background, `lines`, a SmartArt's `words` " +
  "(changed by `replace`), `layout` and `under`, a table's `rows` and " +
  "`columns`, a `chart`'s data, an `animation`), the deck's `layouts`, " +
  "`masters`: the slide master's and each layout's OWN boxes, on every " +
  'slide showing them, changed as a slide\'s with `slide: "master"` or ' +
  '`"layout: <name>"`; ' +
  '`start` + `nextStart` ' +
  'page a long file. `edit` makes MANY changes in ONE call: `replace` ' +
  '[{from, to}] -- words, exactly as written, everywhere; `changes` [...], ' +
  'each naming lines by id AS READ ("2.3" slide 2 line 3; Word "12"): ' +
  '{id, text} rewrites a line (\\n a line break), {id, remove: true}, ' +
  '{after | before: id, text} adds one; `slide` is its number, or the ' +
  'words on it the person named it by ("the prayers slide": "prayers") -- ' +
  'never a number guessed; slides: {slide, note}, {slide, to} ' +
  'moves it, {slide, duplicate: true} copies it after itself (+ `to`), ' +
  '{slide, removeSlide: true}, {slide, hidden}, {slide, background} ' +
  '("none": the layout\'s; "navy to black, left to right": a gradient; ' +
  '"navy stripes on white": a pattern), ' +
  '{slide, transition} (fade, push, wipe, cover, ' +
  'uncover, split, dissolve, zoom, wheel, random, cut, none), {slide, ' +
  'advance: seconds} (0: a click), {slide, removeBox: name}, {slide, box: ' +
  'a SmartArt, toShapes: true, fill?, outline?, arrange?} turns it into ' +
  "shapes (PowerPoint's Convert to Shapes; ask first), its boxes in that " +
  'fill, laid out as a cycle, row or column with `arrange` (in `at`, else ' +
  'its place), ' +
  'each shape changed by its name after, {slide, box: a SmartArt, ' +
  'smartArtLayout, at?} gives it that layout (or the `layout` read on ' +
  'another), still a SmartArt, {slide, box: a SmartArt, smartArtAdd | ' +
  "smartArtRemove | smartArtMove: a box's words, afterBox | beforeBox | " +
  'underBox?: the box it goes by} adds, takes out or moves a box, ' +
  '{slide, box, ' +
  'at} moves or sizes a box (null in `at` keeps one), {slide, textBox: ' +
  'words, at} adds a text box, {slide, shape: arrow|circle|star|line|…, ' +
  'textBox?, at} a shape, {slide, box, shape} gives a box (a picture: cut ' +
  'to it) that shape, {slideNumbers, footer} (no slide: all but a ' +
  "title slide), {slide, picture: an attached picture's " +
  'name, or a link they typed, at} adds it ([0, 0, 100, 100]: behind ' +
  'the words), {box, ' +
  "picture} puts it in that picture's place -- no `slide`: every slide; " +
  "{slide, media: an attached video's or sound's name or link, at, play: " +
  'click|auto} puts it on the slide to play; ' +
  '{newSlide: true, layout, title, lines: [...], to} adds a slide; {slide, ' +
  'box?, animation: appear|fade|fly|wipe|zoom|none, ' +
  'byLine, when: click|with|after, seconds} -- no box: its boxes of ' +
  'words; {slide, table, addRow | removeRow | addColumn | removeColumn: ' +
  'n, cells: [...]}, {slide, table, tableLook: {fill, rows: [n], ' +
  'columns: [n], header, banded, borders}} (colours; null: off); {slide, ' +
  'chart, chartKind: column|bar|line|pie|doughnut|area, chartTitle, ' +
  'categories, series: [{index, name, values}]}; Word: {pageColor} ' +
  '("none" off), {after | before: id, picture, width?: % of the page, ' +
  'only a size they named}; ' +
  '{slideSize: ' +
  '"4:3" | "16:9" | "16:10"}, {theme: {colors: {accent1…6, dark1, ' +
  'light1, dark2, light2, link: colour}, headingFont, bodyFont}} the ' +
  "deck's theme. LOOK of the words on {id}, a {box}, every " +
  'line of {slide}, or every line with none: color, highlight ("none" ' +
  'off), size (pt, or "+20%" / "-10%" from each word\'s own: bigger, ' +
  'smaller), bold, italic, underline, strike, font, shadow, link (url, ' +
  '"slide 3"), align (left|center|' +
  'right|justify), lineSpacing (1.5), bullets (a deck); + `words`: those ' +
  "words only. A BOX's own, on {slide?, box} or IN a textBox / picture change: " +
  'fill (a colour or a gradient "navy to black", a pattern "navy stripes on white"), outline ("none" off), transparency (0-100: a fill\'s or a ' +
  "picture's), brightness (a picture's, -30 darker), rotate (degrees), flip, " +
  'valign (top|middle|bottom), order (front|back|forward|backward). ' +
  'Colours #RRGGBB or a name. ' +
  'Formatting not named is kept. Kept at once (no Save) with a backup ' +
  'owa_undo puts back -- say so. Change only what was asked.';

/**
 * One call: the app reads, changes and writes. Exported for the tests,
 * which hand it a stand-in for the app.
 */
export async function runOfficeEdit(args, runWorker = runOfficeWorker) {
  const target = toOfficeEditTarget(args?.file);
  if (target.reason !== undefined) {
    return toErrorResult(new Error(target.reason));
  }
  const action = args?.action ?? 'read';
  if (!OFFICE_EDIT_ACTIONS.includes(action)) {
    return toErrorResult(
      new Error(`\`action\` is one of ${OFFICE_EDIT_ACTIONS.join(', ')}.`),
    );
  }
  const request = {
    action,
    ...(target.filePath === undefined
      ? { name: target.name }
      : { filePath: target.filePath }),
  };
  for (const key of ['start', 'changes', 'replace']) {
    if (args?.[key] !== undefined) {
      request[key] = args[key];
    }
  }
  const value = await runWorker(request, args?.page);
  if (value.isError === true) {
    return toErrorResult(
      new Error(value.reason ?? 'The file could not be read.'),
    );
  }
  if (action === 'read') {
    return toTextResult(value);
  }
  // The window reads `name`, `isChanged` and `undoId` off this answer
  // (`readEditedLyric`): the button that puts the change back.
  const { didChange, ...rest } = value;
  return toTextResult({
    name: target.name,
    isChanged: didChange !== false,
    ...rest,
  });
}

const LINE_ID_SCHEMA = z.union([z.string().max(20), z.number()]);

const OFFICE_CHANGE_SCHEMA = z.object({
  id: LINE_ID_SCHEMA.optional(),
  text: z.string().max(20000).optional(),
  remove: z.boolean().optional(),
  after: LINE_ID_SCHEMA.optional(),
  before: LINE_ID_SCHEMA.optional(),
  slide: z.union([z.number().int().min(1), z.string().max(120)]).optional(),
  note: z.string().max(20000).optional(),
  to: z.number().int().min(1).optional(),
  duplicate: z.boolean().optional(),
  removeSlide: z.boolean().optional(),
  hidden: z.boolean().optional(),
  background: z.string().max(60).optional(),
  removeBox: z.string().max(200).optional(),
  // a SmartArt turned into the slide's own shapes (2026-11-21)
  toShapes: z.boolean().optional(),
  arrange: z.enum(['cycle', 'row', 'column']).optional(),
  smartArtLayout: z.string().max(100).optional(),
  // a SmartArt's box added, taken out or moved, any layout (EC-787)
  smartArtAdd: z.string().max(2000).optional(),
  smartArtRemove: z.string().max(2000).optional(),
  smartArtMove: z.string().max(2000).optional(),
  afterBox: z.string().max(2000).optional(),
  beforeBox: z.string().max(2000).optional(),
  underBox: z.string().max(2000).optional(),
  everywhere: z.boolean().optional(),
  box: z.string().max(200).optional(),
  at: z.array(z.number().nullable()).length(4).optional(),
  textBox: z.string().max(20000).optional(),
  picture: z.string().max(1024).optional(),
  media: z.string().max(1024).optional(),
  play: z.enum(['click', 'auto']).optional(),
  transition: z.string().max(20).optional(),
  advance: z.number().min(0).max(3600).optional(),
  slideSize: z.string().max(20).optional(),
  // the deck's theme, as Design → Colors / Fonts sets it
  theme: z
    .object({
      colors: z.record(z.string(), z.string().max(40)).optional(),
      headingFont: z.string().max(64).optional(),
      bodyFont: z.string().max(64).optional(),
    })
    .optional(),
  words: z.string().max(2000).optional(),
  color: z.string().max(40).optional(),
  highlight: z.string().max(40).optional(),
  size: z.union([z.number().min(1).max(400), z.string().max(12)]).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  font: z.string().max(80).optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  // the words' shadow, the space from line to line, a deck's bullets, and
  // a box's own look (2026-11-21)
  shadow: z.boolean().optional(),
  strike: z.boolean().optional(),
  link: z.union([z.string().max(2000), z.number()]).optional(),
  shape: z.string().max(40).optional(),
  flip: z.enum(['horizontal', 'vertical', 'both', 'none']).optional(),
  slideNumbers: z.boolean().optional(),
  footer: z.string().max(200).optional(),
  lineSpacing: z.union([z.number(), z.string().max(20)]).optional(),
  bullets: z.boolean().optional(),
  fill: z.string().max(60).optional(),
  outline: z.string().max(40).optional(),
  transparency: z.union([z.number(), z.string().max(12)]).optional(),
  brightness: z.union([z.number(), z.string().max(12)]).optional(),
  rotate: z.union([z.number(), z.string().max(12)]).optional(),
  valign: z.enum(['top', 'middle', 'bottom']).optional(),
  order: z.enum(['front', 'back', 'forward', 'backward']).optional(),
  // an entrance animation on a box (EC-771)
  animation: z.string().max(20).optional(),
  byLine: z.boolean().optional(),
  when: z.enum(['click', 'with', 'after']).optional(),
  seconds: z.number().min(0.1).max(60).optional(),
  // a table's rows and columns
  table: z.string().max(200).optional(),
  addRow: z.number().int().min(1).optional(),
  removeRow: z.number().int().min(1).optional(),
  addColumn: z.number().int().min(1).optional(),
  removeColumn: z.number().int().min(1).optional(),
  cells: z.array(z.string().max(2000)).max(50).optional(),
  // a new slide from one of the deck's layouts
  newSlide: z.boolean().optional(),
  layout: z.string().max(100).optional(),
  title: z.string().max(2000).optional(),
  lines: z.array(z.string().max(2000)).max(50).optional(),
  // a table's own colours
  tableLook: z
    .object({
      fill: z.string().max(40).nullable().optional(),
      rows: z.array(z.number().int().min(1)).max(50).optional(),
      columns: z.array(z.number().int().min(1)).max(50).optional(),
      header: z.boolean().optional(),
      banded: z.boolean().optional(),
      borders: z.string().max(40).nullable().optional(),
    })
    .optional(),
  // a Word page's colour, and a picture's width in % of a Word page
  pageColor: z.string().max(40).optional(),
  width: z.number().min(1).max(100).optional(),
  // a chart's kind, words and numbers
  chart: z.string().max(200).optional(),
  chartKind: z.string().max(20).optional(),
  chartTitle: z.string().max(2000).optional(),
  categories: z.array(z.string().max(200)).max(100).optional(),
  series: z
    .array(
      z.object({
        index: z.number().int().min(0),
        name: z.string().max(200).optional(),
        values: z.array(z.number().nullable()).max(100).optional(),
      }),
    )
    .max(20)
    .optional(),
});

export function registerOfficeEditTool(server) {
  server.registerTool(
    OFFICE_EDIT_TOOL_NAME,
    {
      description: OFFICE_EDIT_DESCRIPTION,
      inputSchema: {
        file: z.string().max(400),
        action: z.enum(OFFICE_EDIT_ACTIONS),
        start: z.number().int().min(1).optional(),
        changes: z.array(OFFICE_CHANGE_SCHEMA).max(200).optional(),
        replace: z
          .array(
            z.object({
              from: z.string().min(1).max(2000),
              to: z.string().max(2000),
            }),
          )
          .max(50)
          .optional(),
        page: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return await runOfficeEdit(args);
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
