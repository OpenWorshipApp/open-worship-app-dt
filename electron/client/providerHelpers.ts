import { htmlFiles, toTitleCase } from '../fsServe';

function freezeObject(obj: any) {
    if (!['object', 'array'].includes(typeof obj)) {
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

export async function initProvider(provider: { [key: string]: any }) {
    const pathName = globalThis.location.pathname;
    if (!pathName?.length) {
        console.log('Waiting for pathName to be ready...');
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        return initProvider(provider);
    }
    for (const [name, htmlFileFullName] of Object.entries(htmlFiles)) {
        provider[`${name}HomePage`] = `/${htmlFileFullName}`;
        const isCurrentPage = pathName.startsWith(`/${htmlFileFullName}`);
        provider[`isPage${toTitleCase(name)}`] = isCurrentPage;
        provider['currentHomePage'] = pathName;
    }
    freezeObject(provider);
    (globalThis as any).provider = (globalThis as any).provider = provider;
}
