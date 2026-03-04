import { htmlFiles, toTitleCase } from '../fsServe';

function freezeObject(obj: any) {
    if (typeof obj !== 'object' || obj === null) {
        return;
    }
    Object.freeze(obj);
    if (Array.isArray(obj)) {
        obj.forEach((item) => {
            freezeObject(item);
        });
    } else if (obj instanceof Object) {
        for (const key in obj) {
            freezeObject(obj[key]);
        }
    }
}

export async function initProvider(
    provider: { [key: string]: any },
    calledCount = 0,
) {
    const pathName = globalThis.location.pathname;
    provider['currentHomePage'] = pathName;
    if (!pathName?.length) {
        if (calledCount >= 20) {
            throw new Error('Path name is not ready after multiple attempts');
        }
        console.log('Waiting for pathName to be ready...');
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        return initProvider(provider, calledCount + 1);
    }
    for (const [name, htmlFileFullName] of Object.entries(htmlFiles)) {
        provider[`${name}HomePage`] = `/${htmlFileFullName}`;
        const isCurrentPage = pathName.startsWith(`/${htmlFileFullName}`);
        provider[`isPage${toTitleCase(name)}`] = isCurrentPage;
    }
    freezeObject(provider);
    (globalThis as any).provider = provider;
}
