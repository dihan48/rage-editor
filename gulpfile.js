const gulp                  = require('gulp');
const del                   = require('del');
const webpack               = require('webpack');
const webpackStream         = require('webpack-stream');
const merge                 = require('merge-stream');
const rename                = require('gulp-rename');
const htmlmin               = require('gulp-htmlmin');
const MonacoWebpackPlugin   = require('monaco-editor-webpack-plugin');

const PACKAGE_NAME  = "rage-editor";

function buildHTML(mode){
    const prod = mode === 'production';

    const other = gulp.src(['./src/server/static/**/*', '!./src/server/static/index.js', '!./src/server/static/index.scss', '!./src/server/static/index.html'])
        .pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}/static`));

    const js = gulp.src('./src/server/static/index.js')
        .pipe(webpackStream({
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        use: ['babel-loader']
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
                    languages: ['javascript', 'typescript']
                })
            ],
            output: {
                filename: 'index.js'
            },
            mode
        }, webpack))
        .pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}/static`));

    const html = gulp.src('./src/server/static/index.html');
    if(prod) html.pipe(htmlmin({collapseWhitespace: true}));
    html.pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}/static`));

    return merge(other, html, js);
}
function buildClient(mode){
    return gulp.src('./src/client/index.js')
        .pipe(webpackStream({
            mode
        }, webpack))
        .pipe(rename('index.js'))
        .pipe(gulp.dest(`./dist/client_packages/${PACKAGE_NAME}`));
}

gulp.task('clean', () => {
    return del([
        'dist/**/*',
        '!dist/packages',
        `!dist/packages/${PACKAGE_NAME}`,
        `!dist/packages/${PACKAGE_NAME}/node_modules/**`
    ]);
});

gulp.task('build:js:client', () => buildClient('production'));
gulp.task('build:js:client:dev', () => buildClient('development'));
gulp.task('build:html', () => buildHTML('production'));
gulp.task('build:html:dev', () => buildHTML('development'));
gulp.task('build:server', () => {
    return gulp.src('./src/server/*')
        .pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}`));
});

gulp.task('build', gulp.series('clean', gulp.parallel('build:js:client', 'build:html', 'build:server')));
gulp.task('watch', gulp.series('clean', gulp.parallel('build:js:client:dev', 'build:html:dev', 'build:server', () => {
    // client js
    gulp.watch('./src/client/*.js', gulp.series('build:js:client:dev'));

    // html
    gulp.watch(['./src/server/static/**/*'], gulp.series('build:html:dev'));

    // server
    gulp.watch('./src/server/*', gulp.series('build:server'));
})));