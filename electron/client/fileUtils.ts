import fs from 'node:fs';

const fileUtils = {
    createWriteStream: fs.createWriteStream,
    createReadStream: fs.createReadStream,
    readdir: fs.readdir,
    stat: fs.stat,
    mkdir: fs.mkdir,
    writeFile: fs.writeFile,
    rename: fs.rename,
    unlink: fs.unlink,
    rmdir: fs.rmdir,
    readFile: fs.readFile,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    unlinkSync: fs.unlinkSync,
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync,
    copyFile: fs.copyFile,
    watch: fs.watch,
    writeFileFromBase64: (filePath: string, base64: string) => {
        if (base64.indexOf(',') >= 0) {
            base64 = base64.split(',')[1];
        }
        const decoded = Buffer.from(base64, 'base64');
        return fs.writeFileSync(filePath, decoded);
    },
};

export default fileUtils;
