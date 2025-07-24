import { createRoot } from 'react-dom/client';

import { getRootElement } from '../appInitHelpers';
import LexicalEditorComp from './LexicalEditorComp';

const container = getRootElement<HTMLDivElement>();
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
