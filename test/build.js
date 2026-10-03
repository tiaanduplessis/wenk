'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wenk-build-'));
const generated = ['wenk.css', 'wenk.min.css', 'wenk.less', 'wenk.scss', 'wenk.cssnext.css'];
const withoutBanner = text => text.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '');
const read = file => fs.readFileSync(path.join(temporary, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(temporary, file), text);
const gulpPath = require.resolve('gulp/bin/gulp');
let passed = 0;

function check(name, assertion) {
  assertion();
  passed += 1;
  console.log('ok ' + passed + ' - ' + name);
}

function gulp(task, success = true) {
  const result = spawnSync(process.execPath, [gulpPath, task], {
    cwd: temporary,
    encoding: 'utf8',
    timeout: 30000
  });
  if (result.error) throw result.error;
  if (success) assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  else assert.notStrictEqual(result.status, 0, 'Invalid input must fail the build');
  return result;
}

function snapshot() {
  const result = {};
  for (const file of generated) result[file] = read('dist/' + file);
  result.demo = read('demo/wenk.min.css');
  return result;
}

async function watchRebuild(task = 'watch') {
  const original = read('src/wenk.css');
  write('watch-ready.js', `
    const gulp = require('gulp');
    const watch = gulp.watch;
    gulp.watch = function () {
      const watcher = watch.apply(this, arguments);
      watcher.once('ready', () => console.log('wenk-watch-ready'));
      return watcher;
    };
  `);
  const child = spawn(process.execPath, ['-r', path.join(temporary, 'watch-ready.js'), gulpPath, task], {
    cwd: temporary,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  let changed = false;
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Watch did not rebuild: ' + output)), 20000);
      function inspect(chunk) {
        output += chunk;
        if (!changed && output.includes('wenk-watch-ready')) {
          if (task === 'default' && !output.includes("Finished 'build'")) {
            reject(new Error('default must build before watching'));
            return;
          }
          changed = true;
          output = '';
          write('src/wenk.css', original + '\n.wenk-watch-fixture { color: red; }\n');
        }
        if (changed && output.includes("Finished 'build'")) resolve();
      }
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.on('error', reject);
      child.on('exit', code => reject(new Error('Watch exited early (' + code + '): ' + output)));
    });
    assert(read('dist/wenk.css').includes('.wenk-watch-fixture'));
    assert.strictEqual(read('demo/wenk.min.css'), read('dist/wenk.min.css'));
  } finally {
    clearTimeout(timer);
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once('exit', resolve);
    });
    write('src/wenk.css', original);
  }
}

async function main() {
  for (const entry of ['gulpfile.js', 'package.json', 'src', 'dist', 'demo']) {
    fs.cpSync(path.join(root, entry), path.join(temporary, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
  const theme = read('dist/themes/material.css');
  const initial = snapshot();
  write('dist/unowned.css', 'unowned sentinel');
  write('dist/themes/custom.css', 'custom theme sentinel');

  check('all public tasks register with Gulp 4', () => {
    const result = gulp('--tasks-simple');
    for (const name of ['clean', 'styles', 'styles:minified', 'styles:less', 'styles:scss', 'styles:cssnext', 'build', 'watch', 'demo', 'default', 'size']) {
      assert(result.stdout.split(/\r?\n/).includes(name), name);
    }
  });

  gulp('clean');
  check('clean removes only the five generated distributions', () => {
    for (const file of generated) assert(!fs.existsSync(path.join(temporary, 'dist', file)), file);
    assert.strictEqual(read('dist/themes/material.css'), theme);
    assert.strictEqual(read('dist/themes/custom.css'), 'custom theme sentinel');
    assert.strictEqual(read('dist/unowned.css'), 'unowned sentinel');
    assert.strictEqual(read('demo/wenk.min.css'), initial.demo);
  });

  gulp('build');
  const first = snapshot();
  check('build completes every output and preserves maintained files', () => {
    for (const file of generated) assert(first[file].length > 0, file);
    assert.strictEqual(first.demo, first['wenk.min.css']);
    assert.strictEqual(read('dist/themes/material.css'), theme);
    assert.strictEqual(read('dist/themes/custom.css'), 'custom theme sentinel');
    assert.strictEqual(read('dist/unowned.css'), 'unowned sentinel');
  });
  check('CSS, CSSNext, Sass, and Less match maintained distributions apart from the banner', () => {
    for (const file of ['wenk.css', 'wenk.cssnext.css', 'wenk.scss', 'wenk.less']) {
      assert.strictEqual(withoutBanner(first[file]), withoutBanner(initial[file]), file);
    }
  });
  check('Sass and Less stay as uncompiled customizable source', () => {
    for (const extension of ['scss', 'less']) {
      assert.strictEqual(withoutBanner(first['wenk.' + extension]), read('src/wenk.' + extension));
    }
    assert(first['wenk.scss'].includes('$wenk-font-size: 13px !default;'));
  });

  gulp('build');
  check('two complete builds are byte-identical', () => assert.deepStrictEqual(snapshot(), first));
  gulp('size');
  check('size task completes', () => {});

  const css = read('src/wenk.css');
  write('src/wenk.css', '[data-wenk] { color: ; invalid {');
  const failure = gulp('build', false);
  check('invalid CSS fails instead of silently succeeding', () => {
    assert(/CssSyntaxError|Unclosed block/.test(failure.stdout + failure.stderr));
  });
  write('src/wenk.css', css);
  fs.renameSync(path.join(temporary, 'src/wenk.less'), path.join(temporary, 'src/wenk.less.saved'));
  gulp('build', false);
  check('missing source fails the build', () => {});
  fs.renameSync(path.join(temporary, 'src/wenk.less.saved'), path.join(temporary, 'src/wenk.less'));
  gulp('build');

  await watchRebuild();
  check('real watch task rebuilds after a source edit and updates the demo', () => {
    assert.strictEqual(read('dist/themes/material.css'), theme);
    assert.strictEqual(read('dist/unowned.css'), 'unowned sentinel');
  });

  await watchRebuild('default');
  check('default builds before watching and rebuilds on edits', () => {});

  // Keep the server/network side-effect out of a build regression test.
  const demoResult = spawnSync(process.execPath, ['-e', `
    const assert = require('assert');
    const Module = require('module');
    const originalLoad = Module._load;
    const watchers = [];
    const browserSync = (options, done) => {
      assert.strictEqual(options.server, './demo');
      done();
    };
    browserSync.reload = () => {};
    Module._load = function (request, parent, main) {
      return request === 'browser-sync' ? browserSync : originalLoad.apply(this, arguments);
    };
    const gulp = require('gulp');
    gulp.watch = (files, task) => {
      watchers.push({ files, task });
      return { on(event, callback) {
        assert.strictEqual(event, 'change');
        assert.strictEqual(callback, browserSync.reload);
      } };
    };
    require('./gulpfile');
    gulp.series('demo')(error => {
      if (error) throw error;
      assert.strictEqual(watchers.length, 2);
      assert.deepStrictEqual(watchers[0].files, ['src/wenk.css', 'src/wenk.less', 'src/wenk.scss']);
      assert.strictEqual(typeof watchers[0].task, 'function');
      assert.strictEqual(watchers[1].files, './demo/**/*');
      console.log('demo-complete');
    });
  `], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
  check('demo setup signals completion and registers callable rebuilds', () => {
    assert.strictEqual(demoResult.status, 0, demoResult.stdout + demoResult.stderr);
    assert(demoResult.stdout.includes('demo-complete'));
  });
  console.log('Passed ' + passed + ' build checks');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
