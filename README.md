# Furucombo

## Overview

Furucombo is a platform that allows user to build their DeFi strategies without hardcore codings.

### Installation

```console
$ npm install
```

### Test

```console
$ npm run test
```

### Usage

Furucombo contracts contains three different parts, **Proxy**, **Registry** and **Handler**.

#### Proxy

Proxy is the gateway of every execution. Proxy does not hold any state and should be clean after every execution.

#### Registry

Registry handles the verification for the valid handlers called by proxy. Every handler should be registered in Registry and unregistered when deprecated. This is also the only part that requires ownership.

#### Handler

Handler implements the logic to interact with the external services. Handlers should be treated as libraries, which does not hold states.

## Contribute

Please refer to the [contribution guide](CONTRIBUTING.md).

## License

Furucombo is released under the [MIT License](LICENSE).
