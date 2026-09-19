import './bootstrapCss';
// The app's own sheets, as `others/main.tsx` loads them, for the `--app-*`
// tokens and the theme overrides. `run()` itself is not used: this window
// has Node taken away (`electron/client/rendererLockdown.ts`) and needs none
// of what `run()` starts.
import './others/appInit.scss';
import './others/bootstrap-override.scss';
import './others/theme-override-dark.scss';
import './others/theme-override-light.scss';
import './others/scrollbar.scss';
import './others/interaction.scss';

import { StrictMode } from 'react';

import { init } from './boot';
import MarkdownPreviewAppComp from './markdown-preview/MarkdownPreviewAppComp';
import { getReactRoot } from './others/rootHelpers';

// Awaited, unlike the chatbot's: this window's labels go through `tran()`,
// which needs the language loaded first.
await init();
const root = getReactRoot();
root.render(
    <StrictMode>
        <MarkdownPreviewAppComp />
    </StrictMode>,
);
