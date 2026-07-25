import { fork } from 'node:child_process';
import { resolve as fsResolve } from 'node:path';
import { app } from 'electron';

import { isDev } from './electronHelpers';

const EXECUTE_TIMEOUT_MILLISECONDS = 1000 * 60 * 10;

export function execute<T>(scriptFullName: string, data: any) {
    return new Promise<T>((resolve, reject) => {
        const scriptPath = fsResolve(
            app.getAppPath(),
            isDev ? 'public' : 'dist',
            'js',
            scriptFullName,
        );
        const forkedProcess = fork(scriptPath);
        // Settle the promise exactly once, whatever combination of message,
        // error, exit and timeout events fires.
        let isSettled = false;
        const settle = (callback: () => void) => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            clearTimeout(timeout);
            forkedProcess.kill();
            callback();
        };
        const timeout = setTimeout(() => {
            settle(() => {
                reject(new Error(`Process timed out: ${scriptFullName}`));
            });
        }, EXECUTE_TIMEOUT_MILLISECONDS);
        forkedProcess.on('message', (message: any) => {
            settle(() => resolve(message));
        });
        forkedProcess.on('error', (error) => {
            settle(() => reject(error));
        });
        forkedProcess.on('exit', (code) => {
            // A child that exits without ever sending a message — even with
            // code 0 — must reject, or the promise (and any `unlocking` lock
            // held on it) would stay pending forever.
            settle(() => {
                reject(new Error(`Process exited with code ${code}`));
            });
        });
        forkedProcess.send(data);
    });
}
