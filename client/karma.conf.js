path = require('path')

// Karma configuration
module.exports = function(config) {
    let configuration = {
        colors: true,
        browsers: ["chrome_webplatform"],
        frameworks: ['mocha'],
        reporters: ['mocha', 'coverage'],
        logLevel: config.LOG_WARN,
        browserConsoleLogOptions: {terminal: false},
        browserNoActivityTimeout: 120000,
        // client: {
        //     mocha: {
        //         require: [require.resolve('babel-polyfill')],
        //     }
        // },
        files: [
            // each file acts as entry point for the webpack configuration
            {pattern: 'test/index.js', watched: true},
            // {pattern: 'test/*.spec.js', watched: true, included: false},
            // {pattern: 'test/**/*.spec.js', watched: true, included: false},
            {pattern: 'test/assets/*', watched: true, included: false, served: true, nocache: false},
            {pattern: 'dist/wav-recorder-worker.js', watched: true, included: false, served: true}
        ],

        proxies: {
            "/assets/": "/base/test/assets/",
            "/dist/": "/base/dist/"
        },

        captureTimeout: 60000,

        preprocessors: {
            // add webpack as preprocessor
            'test/index.js': ['webpack', 'sourcemap'],
        },

        webpack: {
            devtool: 'inline-source-map',
            module: {
                rules: [
                    {
                        test: /\.(js|jsx)$/,
                        exclude: /node_modules/,
                        use: [
                            'babel-loader',
                        ],
                    },
                    // {
                    //     enforce: 'post',
                    //     loader: 'istanbul-instrumenter-loader',
                    //     test: /\.(js|jsx)$/,
                    //     exclude: /(node_modules|test)/
                    // }
                ]
            },
            resolve: {
                extensions: ['.js', '.jsx', '.spec.js'],
                modules: [
                    __dirname,
                    "node_modules"
                ]
            },
            resolveLoader: {
                modules: [
                    __dirname,
                    'node_modules'
                ]
            }
            // karma watches the test entry points
            // (you don't need to specify the entry option)
            // webpack watches dependencies
            // webpack configuration
        },

        webpackMiddleware: {
            // webpack-dev-middleware configuration
            // i. e.
            stats: 'errors-only'
        },

        webpackServer: {
            noInfo: true //please don’t spam the console when running in karma!
        },

        coverageReporter: {
            type: 'html',

            // base output directory
            dir: 'coverage/',
        },

        beforeMiddleware: [
            'webpackBlocker'
        ],

        autoWatch: true,

        customLaunchers: {
            chrome_webplatform: {
                base: "Chrome",
                flags: [
                    "--enable-experimental-web-platform-features",
                    "--unlimited-storage",
                    '--disable-user-media-security',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                ]
            },
            Chrome_travis_ci: {
                base: 'Chrome',
                flags: [
                    '--no-sandbox',
                    '--enable-experimental-web-platform-features',
                    "--unlimited-storage",
                    '--disable-user-media-security',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                ]
            }
        },

        mochaReporter: {
            showDiff: true,
        }
    }
    if (process.env.TRAVIS) {
        configuration.browsers = ['Chrome_travis_ci', 'FirefoxNightly'];
    }
    config.set(configuration)
}