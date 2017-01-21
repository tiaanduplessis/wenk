const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const $ = gulpLoadPlugins();
const pkg = require('./package.json');
const reload = browserSync.reload;

// Pretty banner
const banner = ['/**',
    ' * <%= pkg.name %> - <%= pkg.description %>',
    ' * @version v<%= pkg.version %>',
    ' * (c) ' + new Date().getFullYear() + ' <%= pkg.author %> |',
    ' * @link <%= pkg.homepage %>',
    ' * @license <%= pkg.license %>',
    ' */',
    ' '
].join('\n');

// Default paths
const paths = {
    output: 'dist/',
    input: {
      css: 'src/wenk.css',
      less: 'src/wenk.less',
      scss: 'src/wenk.scss'
    }
};

// Default postcss plugins
const defaultPlugins = [
    require('postcss-cssnext')()
];

// Get size of all files in output dir
gulp.task('size', () => {
    return gulp.src(`${paths.output}**/*`)
        .pipe($.size({
            gzip: true,
            showFiles: true
        }));
});

// Clean output dir
gulp.task('clean', () => {
    return del(`${paths.output}**/*`);
});

// Build minified CSS
gulp.task('styles:minified', () => {
    return gulp.src(paths.input.css)
        .pipe($.plumber())
        .pipe($.postcss(defaultPlugins.concat([
            require('cssnano')()
        ])))
        .pipe($.rename({
            extname: '.min.css'
        }))
        .pipe($.header(banner, {
            pkg
        }))
        .pipe(gulp.dest(paths.output))
        .pipe(gulp.dest('./demo'))
});

// Build CSS
gulp.task('styles', () => {
    return gulp.src(paths.input.css)
        .pipe($.plumber())
        .pipe($.postcss(defaultPlugins))
        .pipe($.header(banner, {
            pkg
        }))
        .pipe(gulp.dest(paths.output))
});

// Less
gulp.task('styles:less', () => {
  return gulp.src(paths.input.less)
    .pipe($.header(banner, {
        pkg
    }))
    .pipe(gulp.dest(paths.output))
})

// SCSS
gulp.task('styles:scss', () => {
  return gulp.src(paths.input.scss)
    .pipe($.header(banner, {
        pkg
    }))
    .pipe(gulp.dest(paths.output))
})

// cssnext
gulp.task('styles:cssnext', () => {
  return gulp.src(paths.input.css)
    .pipe($.header(banner, {
        pkg
    }))
    .pipe($.rename({
        extname: '.cssnext.css'
    }))
    .pipe(gulp.dest(paths.output))
})

gulp.task('build', ['styles', 'styles:minified', 'styles:less', 'styles:scss', 'styles:cssnext']);

gulp.task('watch', () => {
    gulp.watch([paths.input.css, paths.input.less, paths.input.scss], ['clean', 'build'])
});

gulp.task('demo', ['clean', 'build'], () => {
  browserSync({
    server: './demo'
  });

  gulp.watch([paths.input.css, paths.input.less, paths.input.scss], ['build']);
  gulp.watch('./demo/**/*').on('change', reload);
});

gulp.task('default', ['build', 'watch']);
