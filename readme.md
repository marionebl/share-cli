> Quickly share files from command line to your local network

<p align="center">
  <img width="750" src="https://cdn.rawgit.com/marionebl/share-cli/299fa583/demo.svg">
</p>

> Demo created with [svg-term-cli](https://github.com/marionebl/svg-term-cli):

> `cat demo.json | svg-term -o demo.svg`

# share-cli

* :rocket: Dead Simple
* :sparkles: Just works
* :lock: Local network only

share-cli exposes single files to your LAN via http, either from stdin or a given file.
The exposing address is copied to your clipboard automatically.

Afer a complete download or 5 minutes of inactivity share-cli closes automatically.

## Installation

```
npm install -g share-cli
```

## Usage

```
❯ share --help

  Quickly share files from command line to your local network

  Usage
    $ share [file]

  Options
    -n, --name Forced download name of the file

  Examples
    $ share shared.png
    http://192.168.1.1:1337/unequal-wish

    $ cat shared.png | share --name=shared.png
    http://192.168.1.1:1338/important-downtown
```


## Related projects

*  [remote-share-cli](https://github.com/marionebl/remote-share-cli) - Quickly share files from your command line with the world


---
share-cli is built by [Mario Nebl](https://github.com/marionebl) and released
under the [MIT](./license.md) license.
