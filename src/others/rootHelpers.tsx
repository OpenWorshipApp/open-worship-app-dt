import { createRoot } from 'react-dom/client';

export function getReactRoot() {
    const container = document.getElementById('root');
    if (container === null) {
        const message = 'Root element not found';
        globalThis.alert(message);
        throw new Error(message);
    }
    container.innerHTML = '';
    const root = createRoot(container);
    return root;
}
