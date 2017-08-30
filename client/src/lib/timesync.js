export const scheduleRun = (fn, when) => {
    let timeUntil = when - serverTimeNow();
    setTimeout(fn, Math.max(0, timeUntil));
}

export const syncTimeWithServer = async ({url = '/ntp/'} = {}) => {
    const clientRequestTime = +(new Date());
    let resp = await fetch(url);
    const clientResponseTime = +(new Date());
    const serverTime = parseFloat(await resp.text()) * 1000;
    return {
        rtt: clientResponseTime - clientRequestTime,
        offset: serverTime - (clientRequestTime + clientResponseTime) / 2
    };
};

export const startSyncingTime = ({url = '/ntp/', delay = 60000} = {}) => {
    window.timesync = {
        offset: 0,
        rtt: 0,
    };
    let fn = async () => {
        window.timesync = await syncTimeWithServer(url);
    };
    fn();
    setInterval(fn, delay);
};

export const toServerTime = (date) => new Date(+(date) + window.timesync.offset);

export const serverTimeNow = () => toServerTime(new Date());
