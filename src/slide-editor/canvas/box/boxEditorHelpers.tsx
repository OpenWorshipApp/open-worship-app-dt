import { checkIsDarkMode } from '../../../others/initHelpers';

const editorStyle = `
.app-box-editor {
  border: 1px solid transparent;
  cursor: pointer;
}
.app-box-editor:hover {
  border: 1px solid green;
}
.app-box-editor.editable {
  border: 1px solid black;
  box-shadow: 0 0 20px rgb(65, 255, 8);
  animation-duration: 2s;
  animation-name: border-blink;
  animation-iteration-count: infinite;
  cursor: pointer;
}
.app-box-editor.controllable {
  border: 1px solid black;
  cursor: move;
}
.app-box-editor textarea {
  background: transparent;
}

@keyframes border-blink {
  0% {
    border-color: green;
  }
  50% {
    border-color: var(--app-yellow-green);
  }
  100% {
    border-color: green;
  }
}

.editor-controller-box-wrapper {
  position: absolute;
  transform-origin: top left;
  user-select: none;
}
.editor-controller-box-wrapper .object {
  height: 10px;
  width: 10px;
  background-color: #1e88e5;
  position: absolute;
  border-radius: 100px;
  border: 1px solid white;
  user-select: none;
}
.editor-controller-box-wrapper .object:hover {
  background-color: #0d47a1;
}
.editor-controller-box-wrapper .object.left-top {
  top: -5px;
  left: -5px;
  cursor: nw-resize;
}
.editor-controller-box-wrapper .object.left-bottom {
  bottom: -5px;
  left: -5px;
  cursor: sw-resize;
}
.editor-controller-box-wrapper .object.right-top {
  top: -5px;
  right: -5px;
  cursor: ne-resize;
}
.editor-controller-box-wrapper .object.right-bottom {
  bottom: -5px;
  right: -5px;
  cursor: se-resize;
}
.editor-controller-box-wrapper .object.top-mid {
  top: -5px;
  left: calc(50% - 5px);
  cursor: n-resize;
}
.editor-controller-box-wrapper .object.left-mid {
  left: -5px;
  top: calc(50% - 5px);
  cursor: w-resize;
}
.editor-controller-box-wrapper .object.right-mid {
  right: -5px;
  top: calc(50% - 5px);
  cursor: e-resize;
}
.editor-controller-box-wrapper .object.bottom-mid {
  bottom: -5px;
  left: calc(50% - 5px);
  cursor: s-resize;
}
.editor-controller-box-wrapper .object.rotate {
  top: -30px;
  left: calc(50% - 5px);
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
            <style>{editorStyle}</style>;
            <style>{isDarkMode ? editorStyleDark : editorStyleLight}</style>
        </>
    );
}
