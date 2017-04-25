export function requestStorageQuota() {
    return new Promise( (resolve, reject) => {
        if (navigator.webkitPersistentStorage != null) {
            // In Chrome, let's request as much storage as we can.
            // In recent versions it seems requesting 1000GB doesn't
            // error, and just returns as much as we can get.
            navigator.webkitPersistentStorage.requestQuota(
                1024*1024*1024*1024,
                resolve,
                reject
            );
        }
        else {
            resolve(null);
        }
    });
}
export function getStorageUsage() {
    return new Promise( (resolve, reject) => {
        if (navigator.webkitPersistentStorage != null) {
            navigator.webkitTemporaryStorage.queryUsageAndQuota(
                (usedBytes, grantedBytes) => {
                    resolve({quota:grantedBytes, usage:usedBytes})
                },
                reject,
            );
        }
        else if (
            navigator.storage != null
            && navigator.storage.estimate != null
        ) {
            navigator.storage.estimate().then(resolve).catch(reject);
        }
    });
}