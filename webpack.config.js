const path = require('path');
const webpack = require('webpack');
const MonacoEditorPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './src/monaco.js',
    devtool: 'source-map',
    output: {
        path: path.resolve('dist'),
        filename: 'app.js'
    },
    module: {
        rules: [{
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        }]
    },
    resolve: {
        alias: {
            'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api.js'
        }
    },
    plugins: [
        new MonacoEditorPlugin({
            languages: ['javascript', 'typescript'],
            features: []
        })
    ]
};