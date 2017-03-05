var context = require.context('.', true, /.spec.js(x?)$/); //make sure you have your directory and regex test set correctly!
context.keys().forEach(context);