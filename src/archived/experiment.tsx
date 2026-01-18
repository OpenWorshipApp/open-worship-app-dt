import { createRoot } from 'react-dom/client';

import LexicalEditorComp from './LexicalEditorComp';

const container = document.getElementById('root');
if (container === null) {
    const message = 'Root element not found';
    globalThis.alert(message);
    throw new Error(message);
}
const root = createRoot(container);

root.render(
    <div
        style={{
            width: '700px',
            height: '650px',
            overflow: 'hidden',
            margin: 'auto',
        }}
    >
        <LexicalEditorComp />
    </div>,
);
