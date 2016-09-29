# :wink: Wenk
[![GitHub version](https://badge.fury.io/gh/mightyCrow%2Fwenk.svg)](https://badge.fury.io/gh/mightyCrow%2Fwenk)
[![npm version](https://badge.fury.io/js/wenk.svg)](https://badge.fury.io/js/wenk)
[![Bower version](https://badge.fury.io/bo/wenk.svg)](https://badge.fury.io/bo/wenk)

**Wenk** is a Lightweight tooltip written in pure CSS using [PostCSS](http://postcss.org/). The **minified version is just 683 bytes when gzipped** :scream:.

<p align="center">
	<a href="#"><img width="80%" src="media/wenk.gif" alt="wenk"></a>
</p>

## Install
**Install with cdn**

```html
<link rel="stylesheet" href="https://unpkg.com/wenk/dist/wenk.css">
```

**Install with Bower**

```sh
$ bower install wenk
```

**Install with npm**

```sh
$ npm install wenk
```

## Usage
Simply add the `data-wenk` attribute to your HTML with the text you want to display.
```html
<span data-wenk="This is a tooltip!"></span>
```

You can display the tooltip at different positions using the `data-wenk-pos` attribute or the `.wenk--*` class. The default position is at the top.
```html
<span data-wenk="I'm to the right!" data-wenk-pos="right">Wenk to the right!</span>
<span data-wenk="I'm to the left!" data-wenk-pos="left">Wenk to the left!</span>
<span data-wenk="I'm at the bottom!" data-wenk-pos="bottom">Wenk to the button!</span>
<!-- Or -->
<span class="wenk--right" data-wenk="I'm to the right!">Wenk to the right!</span>
<span class="wenk--left" data-wenk="I'm to the left!">Wenk to the left!</span>
<span class="wenk--bottom" data-wenk="I'm at the bottom!">Wenk to the button!</span>
```

The width of the tooltip can also easily be changed.
```html
<span data-wenk="I'm small!" data-wenk-length="small">Small wenk!</span>
<span data-wenk="I'm medium!" data-wenk-length="medium">Medium wenk!</span>
<span data-wenk="I'm large!" data-wenk-length="large">Large wenk!</span>
<span data-wenk="I fit!" data-wenk-length="fit">I fit just right!</span>
<!-- Or -->
<span data-wenk="I'm small!" class="wenk-length--small">Small wenk!</span>
<span data-wenk="I'm medium!" class="wenk-length--large">Medium wenk!</span>
<span data-wenk="I'm large!" class="wenk-length--large">Large wenk!</span>
<span data-wenk="I fit!" class="wenk-length--fit">I fit just right!</span>
```

## Demo
Check out the demo [here](https://mightycrow.github.io/wenk/).

## Contributing
All Contributions are welcome! Please open up an issue if you would like to help out. :smile:

## License
Created with ♥ by [Tiaan du Plessis](https://github.com/mightyCrow). Licensed under the MIT License.
