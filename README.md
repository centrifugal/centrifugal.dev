# centrifugal.dev website

This website is built using [Docusaurus 2](https://v2.docusaurus.io/), a modern static website generator.

## Installation

```console
yarn install
```

## Local Development

```console
yarn start
```

This command starts a local development server and open up a browser window. Most changes are reflected live without having to restart the server.

## Build

```console
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

```console
GIT_USER=<Your GitHub username> USE_SSH=true yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## Build AI context example:

```
npm run build-context -- ./docs/faq "Centrifugo FAQ" ../centrifugo/config.default.json "Centrifugo default JSON configuration" ../centrifuge-js/src "centrifuge-js SDK source code (Javascript)" ../centrifuge-dart/lib "centrifuge-dart SDK source code (Dart)"
```
