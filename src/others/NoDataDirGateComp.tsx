import { tran } from '../lang/langHelpers';
import HandleAlertComp from '../popup-widget/HandleAlertComp';
import { openPathSetting } from '../setting/settingHelpers';
import AppAssistantComp from './AppAssistantComp';

// Imported at the press: the 🤖's module carries the whole header's buttons,
// and this card is in every window's first paint.
async function openAssistant() {
    const { openChatbotOnPress } = await import('./commonButtons');
    await openChatbotOnPress();
}

/**
 * Everything a window shows while no data folder is in use -- none is chosen,
 * or the chosen one is not there. A data folder is required: what the app's
 * own folder still names of an old one is not data, and showing it read as
 * the app holding songs and notes with nothing chosen. Settings keeps the
 * choice itself, with the language, the theme and the AI assistants. The
 * assistant needs no data folder, so it is one press away here too -- with
 * the popup host its two questions are asked in, and the Tools menu entry and
 * Ctrl+Shift+A the window's own tools would have carried.
 */
export default function NoDataDirGateComp() {
    return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center p-3">
            <div
                className="card app-border-white-round p-3"
                style={{ maxWidth: '520px' }}
            >
                <div className="d-flex align-items-center text-warning-emphasis mb-2">
                    <i className="bi bi-folder-x me-2" />
                    <strong>{tran('No Parent Directory Selected')}</strong>
                </div>
                <div className="mb-3">
                    {tran(
                        'You need to select a parent directory to start using the app.',
                    )}
                </div>
                <div className="d-flex flex-wrap gap-2">
                    <button
                        className="btn btn-sm btn-warning"
                        type="button"
                        onClick={() => {
                            openPathSetting();
                        }}
                    >
                        <span>{tran('Go to Settings')}</span>
                        <i className="bi bi-gear-wide-connected ms-1" />
                    </button>
                    <button
                        className="btn btn-sm btn-outline-info"
                        type="button"
                        onClick={() => {
                            void openAssistant();
                        }}
                    >
                        <i className="bi bi-robot me-1" />
                        <span>{tran('App Assistant')}</span>
                    </button>
                </div>
            </div>
            <AppAssistantComp />
            <HandleAlertComp />
        </div>
    );
}
