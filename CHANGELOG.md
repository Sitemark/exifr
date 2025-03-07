# Changelog

## 3.1.7

### Patch Changes

- fc8fa83: Update the project homepage in package.json

## 3.1.6

### Patch Changes

- a07e9a9: Publish on npm instead of github packages

## 3.1.5

### Patch Changes

- 0572093: Publish to github npm packages instead of a github release. This also fixes the
  git and ssh urls in package.json

## [Unreleased]

## [2.0.0]

### Breaking changes

- default export is not longer `getExif()` function. It's available as named export `parse()`along few new ones.

### Added

- thumbnail extraction
- better docs and readme

### Fixed

- `*.tif` and `*.tiff` file support (raw TIFF segments not wrapped in jpg APPn segments)
- many bugfixes, typos, stability improvements

## [1.2.0] - 2019-04-27

### Fixed

- issue #1

## [1.1.0] - 2018-09-29

### Added

- AMD module support

## [1.0.0] - 2018-08-01

### Added

- initial implementation

[Unreleased]: https://github.com/MikeKovarik/exifr/compare/2.0.0...HEAD
[2.0.0]: https://github.com/MikeKovarik/exifr/compare/1.2.0...2.0.0
[1.2.0]: https://github.com/MikeKovarik/exifr/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/MikeKovarik/exifr/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/MikeKovarik/exifr/releases/tag/1.0.0
