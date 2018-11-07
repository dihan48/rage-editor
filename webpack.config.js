const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const PACKAGE_NAME = 'rage-editor';

module.exports = env => {
    return [
        {
            entry: './src/client/index.js',
            mode: env,
            output: {
                path: path.resolve('dist', 'client_packages', PACKAGE_NAME),
                filename: 'index.js'
            },
            plugins: [
                new CleanWebpackPlugin([
                    path.resolve('dist', 'client_packages', PACKAGE_NAME)
                ])
            ]
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
                                "@babel/preset-env",
                                "@babel/preset-react"
                            ],
                            plugins: [
                                "@babel/plugin-proposal-object-rest-spread",
                                "@babel/plugin-proposal-class-properties",
                                "@babel/plugin-syntax-dynamic-import"
                            ]
                        },
                        exclude: [/node_modules/]
                    },
                    {
                        test: /\.css$/,
                        use: ['style-loader', 'css-loader'],
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
                }),
                new CleanWebpackPlugin([
                    path.resolve('dist', 'packages', PACKAGE_NAME)
                ]),
                new CopyWebpackPlugin([{
                    context: 'src/server',
                    from: '**/*',
                    to: '../',
                    ignore: [
                        'static/**/*.js'
                    ]
                }])
            ],
            output: {
                path: path.resolve('dist', 'packages', PACKAGE_NAME, 'static'),
                filename: 'index.js'
            }
        }
    ];
};