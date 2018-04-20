const gulp                  = require('gulp');
const del                   = require('del');
const webpack               = require('webpack');
const webpackStream         = require('webpack-stream');
const merge                 = require('merge-stream');
const sass                  = require('gulp-sass');
const rename                = require('gulp-rename');
const inline                = require('gulp-inline');
const htmlmin               = require('gulp-htmlmin');

const PACKAGE_NAME  = "rage-editor";

function buildHTML(mode){
    const prod = mode === 'production';

    const other = gulp.src(['./src/server/static/**/*', '!./src/server/static/index.js', '!./src/server/static/index.scss', '!./src/server/static/index.html'])
        .pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}/static`));

    const html = gulp.src('./src/server/static/index.html')
        .pipe(inline({
            css: () => sass({ outputStyle: prod ? 'compressed' : 'nested' }),
            js: () => webpackStream({
                module: {
                    rules: [
                        {
                            test: /\.js$/,
                            use: ['babel-loader']
                        }
                    ]
                },
                plugins: [
                    new webpack.IgnorePlugin(/vs\/editor\/editor\.main/)
                ],
                mode
            }, webpack),
            ignore: ['vs/loader.js']
        }));
    if(prod) html.pipe(htmlmin({collapseWhitespace: true}));
    html.pipe(gulp.dest(`./dist/packages/${PACKAGE_NAME}/static`));

    return merge(other, html);
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
gulp.task('watch', gulp.series('clean', gulp.parallel('build:js:client:dev', 'build:html:dev', 'build:server', (done) => {
    // client js
    gulp.watch('./src/client/*.js', gulp.series('build:js:client:dev'));

    // html
    gulp.watch(['./src/server/static/**/*'], gulp.series('build:html:dev'));

    // server
    gulp.watch('./src/server/*', gulp.series('build:server'));
})));