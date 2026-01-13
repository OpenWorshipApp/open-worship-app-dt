import { createContext, use } from 'react';

export const SelectedWebContext = createContext<string | null>(null);

function useContext() {
    const context = use(SelectedWebContext);
    if (context === null) {
        throw new Error('No SelectedWebContext found');
    }
    return context;
}

export function useSelectedWebContext() {
    const context = useContext();
    if (context === null) {
        throw new Error('No selected Web');
    }
    return context;
}
