var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var watchify = require('watchify');
var coffeeify = require('coffeeify')
var browserify = require('browserify');
var handlebars = require('gulp-handlebars');
var wrap = require('gulp-wrap');
var declare = require('gulp-declare');
var concat = require('gulp-concat');
var watch = require('gulp-watch');
var sass = require('gulp-sass')

function getBundler(watch) {
  if (watch) {
    var bundler = watchify(browserify('./src/app.coffee', watchify.args));
  }
  else {
    var bundler = browserify('./src/app.coffee')
  }
  // add any other browserify options or transforms here
  bundler.transform('coffeeify');
  bundler.transform('debowerify');
  return bundler
}

gulp.task('js', function() { bundle(getBundler(false)) }); // so you can run `gulp js` to build the file

gulp.task('templates', function(){
  gulp.src('./assets/templates/*.hbs')
    .pipe(handlebars())
    .pipe(wrap('Handlebars.template(<%= contents %>);'))

    .pipe(declare({
       namespace: 'Handlebars.templates',
       noRedeclare: true, // Avoid duplicate declarations 
     }))
    .pipe(concat('templates.js'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('sass', function() {
  gulp.src('./assets/scss/*.scss')
    .pipe(sass())
    .on('error', function(err){
      displayError(err);
    })
    .pipe(gulp.dest('./dist/'))
})

gulp.task('watch', function() {
  gulp.watch('./assets/scss/*.scss', ['sass'])
  gulp.watch('./assets/templates/**/*.hbs', ['templates'])
  var bundler = getBundler(true)
  bundler.on('update', function() { bundle(bundler) }); // on any dep update, runs the bundler
  bundle(bundler)
})

gulp.task('default', ['js', 'sass', 'templates'], function() {

})


function bundle(bundler) {
  return bundler.bundle()
    // log errors if they happen
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('bundle.js'))
    // optional, remove if you dont want sourcemaps
 //     .pipe(buffer())
 //     .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
 //     .pipe(sourcemaps.write('./')) // writes .map file
    //
    .pipe(gulp.dest('./dist'));
}