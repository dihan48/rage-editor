const gulp      = require('gulp');
const uglifyes  = require('uglify-es');
const uglify    = require('gulp-uglify/composer')(uglifyes, console);
const del       = require('del');
const sass      = require('gulp-sass');
const merge     = require('merge-stream');

gulp.task('clean', () => {
    return del([
        'dist/**/*',
        '!dist/packages',
        '!dist/packages/rage-editor',
        '!dist/packages/rage-editor/node_modules/**'
    ]);
});

gulp.task('minify', () => {
    const client = gulp.src(['./src/client/**/*.js', '!./src/client/html/vs/**/*'])
        .pipe(uglify())
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));

    const server = gulp.src('./src/server/**/*.js')
        .pipe(uglify())
        .pipe(gulp.dest('./dist/packages/rage-editor'));

    return merge(client, server);
});

gulp.task('css', () => {
    return gulp.src(['./src/client/**/*.scss', './src/client/**/*.css', '!./src/client/html/vs/**/*'])
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));
});

gulp.task('other', () => {
    const client = gulp.src(['./src/client/**/*.*', '!./src/client/**/*.scss', '!./src/client/**/*.css', '!./src/client/**/*.js', '!./src/client/html/vs/**/*'])
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));

    const clientVS = gulp.src('./src/client/html/vs/**/*')
        .pipe(gulp.dest('./dist/client_packages/rage-editor/html/vs'));

    return merge(client, clientVS);
});

gulp.task('build', gulp.parallel('minify', 'css', 'other'));

gulp.task('default', gulp.series('clean', 'build'));

gulp.task('copy', gulp.series('clean', gulp.parallel('css', () => {
    const client = gulp.src(['./src/client/**/*', '!./src/client/**/*.scss'])
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));

    const server = gulp.src(['./src/server/**/*', '!./src/server/node_modules/**/*'])
        .pipe(gulp.dest('./dist/packages/rage-editor'));

    return merge(client, server);
})));