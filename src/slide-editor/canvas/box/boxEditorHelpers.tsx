import { checkIsDarkMode } from '../../../others/themeHelpers';

// Each handle's compass direction when the box is unrotated, in degrees
// clockwise from north (matching CSS `*-resize` cursor naming).
const RESIZE_HANDLE_BASE_ANGLE: { [key: string]: number } = {
    'top-mid': 0,
    'right-top': 45,
    'right-mid': 90,
    'right-bottom': 135,
    'bottom-mid': 180,
    'left-bottom': 225,
    'left-mid': 270,
    'left-top': 315,
};
const RESIZE_CURSORS_BY_OCTANT = [
    'n-resize',
    'ne-resize',
    'e-resize',
    'se-resize',
    's-resize',
    'sw-resize',
    'w-resize',
    'nw-resize',
];

export function normalizeDegrees(degrees: number) {
    return ((degrees % 360) + 360) % 360;
}

// CSS only offers 8 fixed-direction resize cursors, so a rotated box's
// handle cursor is approximated by snapping to the nearest of those 8
// directions after accounting for the box's rotation.
export function getRotatedResizeCursor(
    handleClassName: string,
    rotateDeg: number,
) {
    const baseAngle = RESIZE_HANDLE_BASE_ANGLE[handleClassName] ?? 0;
    const angle = normalizeDegrees(baseAngle + rotateDeg);
    const octant = Math.round(angle / 45) % 8;
    return RESIZE_CURSORS_BY_OCTANT[octant];
}

// These boxes render inside a shadow root, so the app's global
// `box-sizing: border-box` doesn't reach them: a border would grow the box
// outward and shift its content by the border width. Since each mode wants a
// different border, that made a box move as it was hovered/selected/edited.
// `outline` paints the same chrome without taking any layout space, keeping
// every mode pixel-identical to the screen output.
const editorStyle = `
.app-box-editor {
  outline: 1px solid transparent;
  cursor: pointer;
}
.app-box-editor:hover {
  outline: 1px solid green;
}
.app-box-editor.editable {
  outline: 1px solid black;
  box-shadow: 0 0 20px rgb(65, 255, 8);
  animation-duration: 2s;
  animation-name: outline-blink;
  animation-iteration-count: infinite;
  cursor: pointer;
}
.app-box-editor.controllable {
  outline: 2px dashed green;
  cursor: move;
}
.app-box-editor.controllable.locked {
  outline: 2px dashed orange;
  cursor: default;
}
.app-box-editor .locked-indicator {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 30px;
  opacity: 0.8;
  user-select: none;
  pointer-events: none;
}
.app-box-editor textarea {
  background: transparent;
}

@keyframes outline-blink {
  0% {
    outline-color: green;
  }
  50% {
    outline-color: var(--app-yellow-green);
  }
  100% {
    outline-color: green;
  }
}

.editor-controller-box-wrapper {
  position: absolute;
  transform-origin: top left;
  user-select: none;
}
.editor-controller-box-wrapper .object {
  height: 14px;
  width: 14px;
  background-color: #1e88e5;
  position: absolute;
  border-radius: 100px;
  border: 1px solid white;
  user-select: none;
  /* The -7px offsets below are half of 14px, so the handle only straddles the
     box edge if its border counts inside that 14px. Without this the shadow
     root's default content-box makes each handle 16px and sits it a pixel
     inside the corner it is supposed to mark. */
  box-sizing: border-box;
}
.editor-controller-box-wrapper .object:hover {
  background-color: #0d47a1;
}
.editor-controller-box-wrapper .object.left-top {
  top: -7px;
  left: -7px;
  cursor: nw-resize;
}
.editor-controller-box-wrapper .object.left-bottom {
  bottom: -7px;
  left: -7px;
  cursor: sw-resize;
}
.editor-controller-box-wrapper .object.right-top {
  top: -7px;
  right: -7px;
  cursor: ne-resize;
}
.editor-controller-box-wrapper .object.right-bottom {
  bottom: -7px;
  right: -7px;
  cursor: se-resize;
}
.editor-controller-box-wrapper .object.top-mid {
  top: -7px;
  left: calc(50% - 7px);
  cursor: n-resize;
}
.editor-controller-box-wrapper .object.left-mid {
  left: -7px;
  top: calc(50% - 7px);
  cursor: w-resize;
}
.editor-controller-box-wrapper .object.right-mid {
  right: -7px;
  top: calc(50% - 7px);
  cursor: e-resize;
}
.editor-controller-box-wrapper .object.bottom-mid {
  bottom: -7px;
  left: calc(50% - 7px);
  cursor: s-resize;
}
.editor-controller-box-wrapper .object.rotate {
  top: -30px;
  left: calc(50% - 7px);
  cursor: alias;
}
.editor-controller-box-wrapper .rotate-link {
  position: absolute;
  width: 1px;
  height: 15px;
  background-color: #1e88e5;
  top: -20px;
  left: calc(50% + 0.5px);
  z-index: -1;
}`;

const editorStyleDark = `
.app-caught-hover-pointer {
  cursor: pointer;
}
.app-caught-hover-pointer:hover {
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.198);
}
`;
const editorStyleLight = `
.shadow-caught-hover-pointer {
  cursor: pointer;
}
.shadow-caught-hover-pointer:hover {
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.198);
}
`;

export function genBoxEditorStyle() {
    const isDarkMode = checkIsDarkMode();
    return (
        <>
            <style>{editorStyle}</style>
            <style>{isDarkMode ? editorStyleDark : editorStyleLight}</style>
        </>
    );
}
