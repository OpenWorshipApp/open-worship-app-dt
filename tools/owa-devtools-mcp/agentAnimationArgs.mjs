// How `owa_animation_edit` reads a call, with nothing imported: the tool,
// the firewall and the banner read a call alike, and the firewall is also
// loaded by the main process (`redactSecrets`), which must not pull the
// tool's schema library in for it.

export const ANIMATION_EDIT_TOOL_NAME = 'owa_animation_edit';

// Held in step with the app's worker (`ANIMATION_AGENT_ACTION_LIST`,
// `ANIMATION_AGENT_FIELD_LIST`); a test holds them together.
export const ANIMATION_EDIT_ACTIONS = ['read', 'set', 'code', 'undo'];
export const ANIMATION_EDIT_FIELDS = [
  'effect',
  'engine',
  'colors',
  'speed',
  'level',
  'opacity',
  'blend',
];

function checkIsPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A call as the model meant it: no action is `code` when code is sent, a
 * `set` when a field is, an `undo` with an id alone, else a `read` (EC-615
 * found a model leaving `action` out of most changes).
 */
export function toAnimationEditArgs(args) {
  const read = checkIsPlainObject(args) ? { ...args } : {};
  if (read.action === undefined) {
    if (typeof read.code === 'string' || read.apply === true) {
      read.action = 'code';
    } else if (
      ANIMATION_EDIT_FIELDS.some((field) => {
        return read[field] !== undefined;
      })
    ) {
      read.action = 'set';
    } else if (typeof read.id === 'string') {
      read.action = 'undo';
    } else {
      read.action = 'read';
    }
  }
  return read;
}
