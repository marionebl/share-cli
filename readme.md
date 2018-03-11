> Quickly share files from your command line

<p align="center">
  <img width="750" src="./demo.svg">
</p>

> Demo created with [svg-term-cli](https://github.com/marionebl/svg-term-cli):
> `cat demo.json | svg-term -o demo.svg`

# share-cli

* :rocket: Dead dimple
* :sparkles: Just works
* :lock: Encrypted files

share-cli exposes files via HTTP, either from stdin or a given file glob.

The exposing address is copied to your clipboard automatically.
Files are made available as password-protected, encrypted ZIP file.

## Installation

```
npm install -g share-cli
```

## Usage

```
❯ share --help

  Quickly share files from your command line

  Usage
    $ share [file]

  Options
    --no-tunnel  - Disable localtunnel usage
```

---
share-cli is built by [Mario Nebl](https://github.com/marionebl) and released
under the [MIT](./license.md) license.
