const appUtils = {
    handleError: (error: any) => {
        console.trace('An error occurred:');
        console.error(error);
    },
    base64Encode: (str: string) => {
        return Buffer.from(str).toString('base64');
    },
    base64Decode: (str: string) => {
        return Buffer.from(str, 'base64').toString();
    },
};

export default appUtils;
