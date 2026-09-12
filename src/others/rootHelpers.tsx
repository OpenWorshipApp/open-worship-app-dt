import { createRoot } from 'react-dom/client';

/**
 * The React root for a page.
 *
 * Takes an id because a page may host more than one: the Lyric Editor's body
 * belongs to the Open Lyric dashboard, which mounts itself imperatively, so the
 * app's own window-level widgets get a container of their own beside it.
 */
export function getReactRoot(containerId = 'root') {
    const container = document.getElementById(containerId);
    if (container === null) {
        const message = `Root element not found: #${containerId}`;
        globalThis.alert(message);
        throw new Error(message);
    }
    container.innerHTML = '';
    const root = createRoot(container);
    return root;
}
