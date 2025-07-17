import { resolve } from 'node:path';
import { toUnpackedPath, unlocking } from '../electronHelpers';

let timeOutId: NodeJS.Timeout | null = null;
let powerPoint: any = null;
function scheduleRelease() {
    if (timeOutId !== null) {
        clearTimeout(timeOutId);
    }
    timeOutId = setTimeout(() => {
        if (timeOutId === null) {
            return;
        }
        timeOutId = null;
        powerPoint = null;
    }, 10e3); // 10 seconds timeout
}
async function getPowerPointHelper(dotNetRoot?: string) {
    return unlocking('getPowerPointHelper' + dotNetRoot, async () => {
        try {
            scheduleRelease();
            if (powerPoint !== null) {
                return powerPoint.Helper;
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
                resolve(__dirname, '../../bin-helper/net8.0/PowerPoint'),
            );
            powerPoint = dotnet.require(binaryPath);
            return powerPoint.Helper;
        } catch (error) {
            console.error('Error in getSlidesCount:', error);
        }
        return null;
    });
}

export const powerPointUtils = { getPowerPointHelper };
