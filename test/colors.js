'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const cssnext = require('postcss-cssnext');
const cssnano = require('cssnano');
const sass = require('sass');
const less = require('less');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const colors = {
  danger: ['#b91c1c', '#fff'],
  warning: ['#facc15', '#111'],
  success: ['#15803d', '#fff'],
  info: ['#1d4ed8', '#fff'],
  black: ['#111', '#fff'],
  white: ['#fff', '#111']
};
const isColor = selector => /data-wenk-color|wenk-color--/.test(selector);
let passed = 0;

function check(name, assertion) {
  assertion();
  console.log('ok ' + (++passed) + ' - ' + name);
}

// Normalize prefixing, equivalent color/unit spellings and merged selectors.
// The separate orderedCascade check verifies cross-selector precedence.
async function rules(css) {
  const result = await postcss([cssnext(), cssnano()]).process(css, { from: undefined });
  const map = {};
  result.root.walkRules(rule => {
    assert.strictEqual(rule.parent.type, 'root', 'Unexpected nested or media rule');
    for (const selector of rule.selectors) {
      const key = selector.replace(/\s+/g, ' ').replace(/"/g, '').trim();
      if (!map[key]) map[key] = {};
      rule.walkDecls(decl => {
        map[key][decl.prop] = decl.value + (decl.important ? '!important' : '');
      });
    }
  });
  return map;
}

// Preserve rule order, duplicate fallback declarations and !important flags.
// Only lexical differences emitted by the three compilers are normalized.
async function orderedCascade(css, compiled = false) {
  const root = compiled ? postcss.parse(css) : (await postcss([cssnext()]).process(css, { from: undefined })).root;
  const ordered = [];
  for (const rule of root.nodes.filter(node => node.type === 'rule')) {
    const selectors = rule.selectors.map(selector => selector.replace(/"/g, '').trim()).sort();
    const declarations = [];
    rule.walkDecls(decl => {
      const value = decl.value.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ',').replace(/\b0\./g, '.')
        .replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3');
      declarations.push([decl.prop, value, Boolean(decl.important)]);
    });
    ordered.push({ selectors, declarations });
  }
  return ordered;
}

function luminance(hex) {
  const full = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  return full.match(/../g).map(value => parseInt(value, 16) / 255).map(value =>
    value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  ).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

async function main() {
  const source = read('src/wenk.css');
  const css = await rules(source);
  const compiledScss = sass.compileString(read('src/wenk.scss')).css;
  const compiledLess = (await less.render(read('src/wenk.less'))).css;
  const scss = await rules(compiledScss);
  const lessCss = await rules(compiledLess);
  const baseline = await rules(read('test/fixtures/default.css'));

  check('CSSNext, Sass and Less compile to equivalent selectors and declarations', () => {
    assert.deepStrictEqual(scss, css);
    assert.deepStrictEqual(lessCss, css);
  });
  const order = await orderedCascade(source);
  const baselineOrder = await orderedCascade(read('test/fixtures/default.css'), true);
  const scssOrder = await orderedCascade(compiledScss);
  const lessOrder = await orderedCascade(compiledLess);
  check('all source formats preserve cross-selector cascade order and the default baseline', () => {
    assert.deepStrictEqual(scssOrder, order);
    assert.deepStrictEqual(lessOrder, order);
    assert.deepStrictEqual(order.filter(rule => !rule.selectors.every(isColor)), baselineOrder);
  });
  check('all existing selectors, hover and empty-tooltip rules retain their declarations', () => {
    assert.deepStrictEqual(Object.fromEntries(Object.entries(css).filter(([selector]) => !isColor(selector))), baseline);
    assert.strictEqual(css['[data-wenk]:after']['background-color'], 'rgba(17,17,17,.8)');
    assert.strictEqual(css['[data-wenk=]:after'].visibility, 'hidden!important');
    assert.strictEqual(css['[data-wenk]:after']['pointer-events'], 'none');
  });
  check('only six explicit color pairs are added, without changing visibility or layout', () => {
    assert.strictEqual(Object.keys(css).filter(isColor).length, 12);
    for (const [name, [background, foreground]] of Object.entries(colors)) {
      const attribute = css['[data-wenk][data-wenk-color=' + name + ']:after'];
      const className = css['[data-wenk].wenk-color--' + name + ':after'];
      assert.deepStrictEqual(attribute, { 'background-color': background, color: foreground });
      assert.deepStrictEqual(className, attribute);
    }
  });
  check('every default color pair exceeds 4.5:1 text contrast', () => {
    for (const [name, pair] of Object.entries(colors)) {
      const values = pair.map(luminance).sort((a, b) => b - a);
      const ratio = (values[0] + 0.05) / (values[1] + 0.05);
      assert(ratio >= 4.5, name + ': ' + ratio);
      console.log('  ' + name + ': ' + ratio.toFixed(2) + ':1');
    }
  });

  for (const file of ['dist/wenk.css', 'dist/wenk.min.css', 'demo/wenk.min.css', 'dist/wenk.cssnext.css']) {
    const artifact = read(file);
    if (!file.endsWith('cssnext.css')) {
      check(file + ' is already compiled, flat CSS', () => {
        const raw = postcss.parse(artifact);
        raw.walkRules(rule => {
          assert.strictEqual(rule.parent.type, 'root');
          assert(!rule.selector.includes('&'), rule.selector);
        });
        raw.walkDecls(decl => {
          assert(!decl.prop.startsWith('--'), decl.prop);
          assert(!/var\(/.test(decl.value), decl.value);
        });
      });
    }
    if (file === 'dist/wenk.css') {
      const actualOrder = await orderedCascade(artifact, true);
      check('unminified distribution preserves rule order and legacy fallbacks', () => assert.deepStrictEqual(actualOrder, order));
    }
    const actual = await rules(artifact);
    check(file + ' contains the same complete stylesheet', () => assert.deepStrictEqual(actual, css));
  }
  for (const ext of ['scss', 'less']) {
    check('distributed ' + ext + ' preserves customizable source', () => {
      assert.strictEqual(read('dist/wenk.' + ext).replace(/^\/\*\*[\s\S]*?\*\/\s*/, ''), read('src/wenk.' + ext));
    });
  }

  const overrides = { 'background-color': '#123456', color: '#fedcba' };
  for (const [name, [background, foreground]] of Object.entries(colors)) {
    const customized = [
      await rules(source.replace('--bg-color-' + name + ': ' + background + ';', '--bg-color-' + name + ': #123456;').replace('--font-color-' + name + ': ' + foreground + ';', '--font-color-' + name + ': #fedcba;')),
      await rules(sass.compileString('$wenk-bg-color-' + name + ': #123456; $wenk-font-color-' + name + ': #fedcba;\n' + read('src/wenk.scss')).css),
      await rules((await less.render(read('src/wenk.less') + '\n@wenk-bg-color-' + name + ': #123456; @wenk-font-color-' + name + ': #fedcba;')).css)
    ];
    check('all source formats allow overriding the ' + name + ' background/text pair', () => {
      for (const actual of customized) {
        assert.deepStrictEqual(actual['[data-wenk][data-wenk-color=' + name + ']:after'], overrides);
        assert.deepStrictEqual(actual['[data-wenk].wenk-color--' + name + ':after'], overrides);
        for (const selector of Object.keys(css).filter(selector => !selector.includes(name))) {
          assert.deepStrictEqual(actual[selector], css[selector], selector);
        }
      }
    });
  }
  console.log('Passed ' + passed + ' color checks (browser rendering is a separate check)');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
