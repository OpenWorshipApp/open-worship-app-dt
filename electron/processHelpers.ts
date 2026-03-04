import { fork } from 'node:child_process';
import { resolve as fsResolve } from 'node:path';
import { app } from 'electron';

import { isDev } from './electronHelpers';

export function execute<T>(scriptFullName: string, data: any) {
    return new Promise<T>((resolve, reject) => {
        const scriptPath = fsResolve(
            app.getAppPath(),
            isDev ? 'public' : 'dist',
            'js',
            scriptFullName,
        );
        const forkedProcess = fork(scriptPath);
        forkedProcess.on('message', (data: any) => {
            forkedProcess.kill();
            resolve(data);
        });
        forkedProcess.on('error', (error) => {
            forkedProcess.kill();
            reject(error);
        });
        forkedProcess.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        forkedProcess.send(data);
    });
}
