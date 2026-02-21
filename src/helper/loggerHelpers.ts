import appProvider from '../server/appProvider';

const logLevelMapper = {
    verbose: ['error', 'warn', 'log', 'trace'],
    minimal: ['error', 'warn'],
    critical: ['error'],
};
const logLevel: 'verbose' | 'minimal' | 'critical' = 'verbose';
const logLevelList = logLevelMapper[logLevel];

function callConsole(method: string, ...args: any[]) {
    if (!logLevelList.includes(method)) {
        return;
    }
    const callable = (console as any)[method] as
        | ((...args: any) => void)
        | undefined;
    callable?.call(console, ...args);
    if (!appProvider.isPagePresenter) {
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
