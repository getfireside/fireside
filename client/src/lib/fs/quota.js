export function requestStorageQuota() {
    return new Promise( (resolve, reject) => {
        if (navigator.webkitPersistentStorage != null) {
            // In Chrome, request 10GB, which is currently the maximum
            // that we can store using the filesystem API.
            let bytesToRequest = 10737418240;
            getStorageUsage().then(({quota}) => {
                if (quota == 0) {
                    navigator.webkitPersistentStorage.requestQuota(
                        bytesToRequest,
                        resolve,
                        reject
                    );
                }
                else {
                    resolve(bytesToRequest);
                }
            });
        }
        else {
            resolve();
        }
    });
}
export function getStorageUsage() {
    return new Promise( (resolve, reject) => {
        if (navigator.webkitPersistentStorage != null) {
            navigator.webkitPersistentStorage.queryUsageAndQuota(
                (usedBytes, grantedBytes) => {
                    resolve({quota:grantedBytes, usage:usedBytes});
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
        else {
            reject(new Error('Quota info unsupported'));
        }
    });
}