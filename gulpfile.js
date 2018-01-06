const gulp      = require('gulp');
const uglifyes  = require('uglify-es');
const uglify    = require('gulp-uglify/composer')(uglifyes, console);
const clean     = require('gulp-clean');
const sass      = require('gulp-sass');
const merge     = require('merge-stream');

gulp.task('clean', () => {
    return gulp.src('./dist')
        .pipe(clean({
            read: false
        }));
});

gulp.task('minify', () => {
    const client = gulp.src(['./src/client/**/*.js', '!./src/client/vs/**/*'])
        .pipe(uglify())
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));

    const server = gulp.src('./src/server/**/*.js')
        .pipe(uglify())
        .pipe(gulp.dest('./dist/packages/rage-editor'));

    return merge(client, server);
});

gulp.task('css', () => {
    return gulp.src(['./src/client/**/*.scss', './src/client/**/*.css', '!./src/client/vs/**/*'])
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));
});

gulp.task('other', () => {
    const client = gulp.src(['./src/client/**/*.*', '!./src/client/**/*.scss', '!./src/client/**/*.css', '!./src/client/**/*.js', '!./src/client/vs/**/*'])
        .pipe(gulp.dest('./dist/client_packages/rage-editor'));

    const clientVS = gulp.src('./src/client/vs/**/*')
        .pipe(gulp.dest('./dist/client_packages/rage-editor/vs'));

    return merge(client, clientVS);
});

gulp.task('build', gulp.parallel('minify', 'css', 'other'));

gulp.task('default', gulp.series('clean', 'build'));