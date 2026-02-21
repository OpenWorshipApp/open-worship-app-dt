import LexicalEditorComp from './LexicalEditorComp';
import { getReactRoot } from '../others/rootHelpers';

const root = getReactRoot();

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
