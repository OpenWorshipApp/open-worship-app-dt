import appProvider from '../server/appProvider';

const logLevelMapper = {
    verbose: ['error', 'warn', 'log', 'trace'],
    minimal: ['error', 'warn'],
    critical: ['error'],
};

/**
 * `verbose` used to be a hardcoded constant, so every `appLog` shipped: the
 * first use of the Find view writes one line per book of the bible plus a
 * total — 67 `console.log` calls — in a packaged build as much as in dev.
 *
 * Errors and warnings still go out in production: the Report tool reads the
 * console for its own bug reports and those are the lines worth having. Only
 * the debug chatter is dev-only.
 *
 * Read per call rather than at module load, and defaulting to `verbose` when
 * the provider cannot say: a test that stubs `appProvider` without
 * `systemUtils` must not lose its logs, and an unknown environment is the one
 * where diagnostics are worth most.
 */
function getLogLevelList() {
    const isDev = appProvider.systemUtils?.isDev ?? true;
    return logLevelMapper[isDev ? 'verbose' : 'minimal'];
}

function callConsole(method: string, ...args: any[]) {
    if (!getLogLevelList().includes(method)) {
        return;
    }
    const callable = (console as any)[method] as
        ((...args: any) => void) | undefined;
    callable?.call(console, ...args);
    if (
        method !== 'warn' &&
        !(
            appProvider.isPagePresenter ||
            appProvider.isPageAppDocumentEditor ||
            appProvider.isPageReader ||
            appProvider.isPageExperiment
        )
    ) {
        appProvider.messageUtils.sendData('all:app:log', [
            `:${appProvider.currentHomePage}:`,
            ...args,
        ]);
    }
}

export function appLog(...args: any[]) {
    callConsole('log', ...args);
}

export function appError(...args: any[]) {
    callConsole('error', ...args);
}

export function appWarning(...args: any[]) {
    callConsole('warn', ...args);
}

export function appTrace(...args: any[]) {
    callConsole('trace', ...args);
}
