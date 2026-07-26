import { getReactRoot } from '../others/rootHelpers';
import HtmlInCanvasComp from './html-in-canvas/HtmlInCanvasComp';

const root = getReactRoot();

function ExperimentComp() {
    return (
        <div
            style={{
                overflow: 'hidden',
                margin: 'auto',
            }}
        >
            <HtmlInCanvasComp />
        </div>
    );
}

root.render(<ExperimentComp />);
