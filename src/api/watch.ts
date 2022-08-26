import { isMappingPresent } from '../utils/watch';
import path from 'path';
import { ipcRenderer } from 'electron';
import { ElectronFile } from '../types';
import { getElectronFile, getFilesFromDir } from '../services/fs';
import { getWatchMappings, setWatchMappings } from '../services/watch';

export async function addWatchMapping(
    rootFolderName: string,
    folderPath: string,
    uploadStrategy: number
) {
    const watchMappings = getWatchMappings();
    if (isMappingPresent(watchMappings, folderPath)) {
        return;
    }

    await ipcRenderer.invoke('add-watcher', {
        dir: folderPath,
    });

    watchMappings.push({
        rootFolderName,
        uploadStrategy,
        folderPath,
        files: [],
    });

    setWatchMappings(watchMappings);
}

export async function removeWatchMapping(folderPath: string) {
    let watchMappings = getWatchMappings();
    const watchMapping = watchMappings.find(
        (mapping) => mapping.folderPath === folderPath
    );

    if (!watchMapping) {
        return;
    }

    await ipcRenderer.invoke('remove-watcher', {
        dir: watchMapping.folderPath,
    });

    watchMappings = watchMappings.filter(
        (mapping) => mapping.folderPath !== watchMapping.folderPath
    );

    setWatchMappings(watchMappings);
}

export async function getAllFilesFromDir(dirPath: string) {
    const files = await getFilesFromDir(dirPath);
    const electronFiles = await Promise.all(files.map(getElectronFile));
    return electronFiles;
}

export function registerWatcherFunctions(
    addFile: (file: ElectronFile) => Promise<void>,
    removeFile: (path: string) => Promise<void>,
    removeFolder: (folderPath: string) => Promise<void>
) {
    ipcRenderer.removeAllListeners('watch-add');
    ipcRenderer.removeAllListeners('watch-change');
    ipcRenderer.removeAllListeners('watch-unlink');
    ipcRenderer.on('watch-add', async (_, filePath: string) => {
        filePath = filePath.split(path.sep).join(path.posix.sep);
        await addFile(await getElectronFile(filePath));
    });
    ipcRenderer.on('watch-change', async (_, filePath: string) => {
        filePath = filePath.split(path.sep).join(path.posix.sep);
        await removeFile(filePath);
        await addFile(await getElectronFile(filePath));
    });
    ipcRenderer.on(
        'watch-unlink',
        async (_, filePath: string, isDir?: boolean) => {
            filePath = filePath.split(path.sep).join(path.posix.sep);
            if (isDir) {
                await removeFolder(filePath);
            } else {
                await removeFile(filePath);
            }
        }
    );
}
