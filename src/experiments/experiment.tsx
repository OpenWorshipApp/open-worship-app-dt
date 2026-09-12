// Bootstrap CSS and `init` are imported OUT of `src/experiments`, which the
// build's `exclude-experiments` plugin allows -- it only refuses imports the
// other way, into this directory. `experiment.html` is not a build input at
// all, so none of this reaches a packaged app.
import '../bootstrapCss';
import { init } from '../boot';
import AppWindowToolsComp from '../others/AppWindowToolsComp';
import { getReactRoot } from '../others/rootHelpers';
import HtmlInCanvasComp from './html-in-canvas/HtmlInCanvasComp';

const root = getReactRoot();

function ExperimentComp() {
    return (
        <div
            style={{
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <HtmlInCanvasComp />
            <AppWindowToolsComp />
        </div>
    );
}

// Rendered from the callback rather than straight away: the window tools name
// their menu entry with `tran`, which needs the locale `init` loads.
init(() => {
    root.render(<ExperimentComp />);
});
