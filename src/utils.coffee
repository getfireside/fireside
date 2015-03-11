pad = (num, size) ->
    s = num + ""
    while (s.length < size) 
        s = "0" + s
    return s

formatLength = (difference) -> pad(Math.floor(difference / 60), 2) + ':' + pad(Math.round(difference % 60), 2)

exports = {pad, formatLength}