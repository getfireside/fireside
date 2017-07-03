export const getCookie = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i += 1) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (`${name}=`)) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};

export const fetchPutBlob = async (url, blob, {headers = {}, onProgress = null} = {}) => {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'json'
        xhr.open('put', url);
        for (var k in headers) {
            xhr.setRequestHeader(k, headers[k]);
        }
        xhr.onload = e => {
            if (xhr.status.toString()[0] == '2') {
                resolve(xhr.response);
            }
            else {
                reject(xhr);
            }
        };
        xhr.onerror = () => reject(new TypeError("Network request failed"));
        xhr.ontimeout = () => reject(new TypeError("Network request failed"));

        if (xhr.upload && onProgress)
            xhr.upload.onprogress = onProgress; // event.loaded / event.total * 100 ; //event.lengthComputable
        xhr.send(blob);
    });
};

export const fetchPost = async (url, data, method = 'POST') => {
    let response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'same-origin',
        body: JSON.stringify(data),
    });
    let contentType = response.headers.get('content-type');
    let responseIsJSON =
        contentType &&
        contentType.indexOf('application/json') !== -1;

    if (responseIsJSON) {
        let responseData = await response.json();
        if (response.ok) {
            return responseData;
        }
        else {
            let err = new Error(JSON.stringify(responseData));
            err.data = responseData;
            throw err;
        }
    }
    else {
        throw new Error(response.statusText);
    }
};

export const fetchJSON = async (url, data) => {
    let response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
    });
    let contentType = response.headers.get('content-type');
    let responseIsJSON =
        contentType &&
        contentType.indexOf('application/json') !== -1;
    if (responseIsJSON) {
        let responseData = await response.json();
        if (response.ok) {
            return responseData;
        }
        else {
            let err = new Error(JSON.stringify(responseData));
            err.data = responseData;
            throw err;
        }
    }
    else {
        throw new Error(response.statusText);
    }
};