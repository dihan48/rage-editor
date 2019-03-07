const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const PACKAGE_NAME = 'rage-editor';

module.exports = env => [
    {
        entry: './src/client/index.js',
        mode: env,
        output: {
            path: path.resolve('dist', 'client_packages', PACKAGE_NAME),
            filename: 'index.js'
        },
        plugins: [
            new CleanWebpackPlugin()
        ]
    },
    {
        entry: './src/server/index.js',
        mode: env,
        target: 'node',
        node: {
            __dirname: false
        },
        plugins: [
            new CleanWebpackPlugin(),
            new CopyWebpackPlugin([{
                context: 'src/server',
                from: '**/*',
                to: './',
                ignore: [
                    './index.js',
                    'static/**/*.js'
                ]
            }])
        ],
        externals: function(ctx, req, callback){
            if(req === 'ngrok' || req === './config.json') callback(null, 'commonjs ' + req);
            else callback();
        },
        output: {
            path: path.resolve('dist', 'packages', PACKAGE_NAME),
            filename: 'index.js'
        }
    },
    {
        entry: './src/server/static/index.js',
        mode: env,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    browsers: ["last 2 Chrome versions"]
                                }
                            }],
                            '@babel/preset-react'
                        ],
                        plugins: [
                            '@babel/plugin-proposal-object-rest-spread',
                            '@babel/plugin-proposal-class-properties',
                            '@babel/plugin-syntax-dynamic-import'
                        ],

                    },
                    exclude: [/node_modules/]
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                }
            ]
        },
        resolve: {
            alias: {
                'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api.js'
            }
        },
        plugins: [
            new MonacoWebpackPlugin({
                output: 'workers',
                languages: ['javascript', 'typescript'],
                features: []
            })
        ],
        output: {
            path: path.resolve('dist', 'packages', PACKAGE_NAME, 'static'),
            filename: 'index.js'
        }
    }
];