import { resolve } from 'node:path';
import { toUnpackedPath, unlocking } from '../electronHelpers';

let timeOutId: NodeJS.Timeout | null = null;
let helperInstance: any = null;
function scheduleRelease() {
    if (timeOutId !== null) {
        clearTimeout(timeOutId);
    }
    timeOutId = setTimeout(() => {
        if (timeOutId === null) {
            return;
        }
        timeOutId = null;
        helperInstance = null;
    }, 10e3); // 10 seconds timeout
}
async function getMSHelper(dotNetRoot?: string) {
    return unlocking('getMSHelper' + dotNetRoot, async () => {
        try {
            scheduleRelease();
            if (helperInstance !== null) {
                return helperInstance.Helper;
            }
            if (dotNetRoot) {
                process.env.DOTNET_ROOT = dotNetRoot;
            } else {
                process.env.DOTNET_ROOT = toUnpackedPath(
                    resolve(__dirname, '../../bin-helper/bin'),
                );
            }
            const modulePath = toUnpackedPath(
                resolve(__dirname, '../../bin-helper/node-api-dotnet/net8.0'),
            );
            const dotnet = require(modulePath);
            const binaryPath = toUnpackedPath(
                resolve(__dirname, '../../bin-helper/net8.0/Helper'),
            );
            helperInstance = dotnet.require(binaryPath);
            return helperInstance.Helper;
        } catch (error) {
            console.error('Error in getMSHelper:', error);
        }
        return null;
    });
}

export const msUtils = { getMSHelper };
