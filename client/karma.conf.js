path = require('path')

// Karma configuration
module.exports = function(config) {
    let configuration = {
        colors: true,
        browsers: ["chrome_webplatform", "FirefoxNightly"],
        frameworks: ['mocha'],
        reporters: ['progress', 'mocha', 'coverage-istanbul'],
        logLevel: config.LOG_WARN,
        browserConsoleLogOptions: {terminal: false},
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
                    {
                        enforce: 'post',
                        loader: 'istanbul-instrumenter-loader',
                        test: /\.(js|jsx)$/,
                        exclude: /(node_modules|test)/
                    }
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

        coverageIstanbulReporter: {
            reports: ['html'],

            // base output directory
            dir: './coverage',

            // if using webpack and pre-loaders, work around webpack breaking the source path
            fixWebpackSourcePaths: true,

            // Most reporters accept additional config options. You can pass these through the `report-config` option
            'report-config': {
                // all options available at: https://github.com/istanbuljs/istanbul-reports/blob/590e6b0089f67b723a1fdf57bc7ccc080ff189d7/lib/html/index.js#L135-L137
                html: {
                    // outputs the report in ./coverage/html
                    subdir: 'html'
                }
            }
        },

        beforeMiddleware: [
            'webpackBlocker'
        ],

        autoWatch: true,

        customLaunchers: {
            chrome_webplatform: {
                base: "Chrome",
                flags: ["--enable-experimental-web-platform-features"]
            },
            Chrome_travis_ci: {
                base: 'Chrome',
                flags: ['--no-sandbox', '--enable-experimental-web-platform-features']
            }
        }
    }
    if (process.env.TRAVIS) {
        configuration.browsers = ['Chrome_travis_ci', 'FirefoxNightly'];
    }
    config.set(configuration)
}