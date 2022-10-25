# Furucombo

## Overview

Furucombo is a platform that allows user to build their DeFi strategies without hardcore codings.

### Installation

```console
$ npm install
```

### Test

The testing is performed through the fork function of [ganache-cli](https://github.com/trufflesuite/ganache-cli). The location of the data source is defined under `$RPC_URL`. You may perform the testing by your own rpc node instance or service provider like [Infura](https://infura.io/).

```console
$ export RPC_URL=https://mainnet.infura.io/v3/{Your_project_ID}
$ npm run test
```

or

```console
$ RPC_URL=https://mainnet.infura.io/v3/{Your_project_ID} npm run test
```

### Deploy

#### In-memory hardhat node

Deploy all contracts under deploy/

```console
npx hardhat deploy
```

#### Private beta node

Take `HFunds` for example.

```console
1. Add ETH_BETA_SECRET to .env
2. npx hardhat --network ethBeta deploy --tags HFunds
3. Add the new address of HFunds to deploy/utils/addresses_eth_beta.js
4. npx hardhat --network ethBeta deploy --tags HFundsPostSetup
```

### Production

Take `HFunds` for example. Refer to `hardhat.config.js` for the network name.

```console
1. Add ${network_name}_SECRET to .env
2. npx hardhat --network ${network_name} deploy --tags HFunds
3. Add the new address of HFunds to deploy/utils/addresses_${network_name}.js
4. Register the new address using Gnosis Safe
```

### Notice

Certain EVM blockchain (e.g. Arbitrum Nitro) have non-standard EIP-2718 typed transaction that would prevent hardhat fork from working due to Unknown transaction type.  
To workaround this:

```console
1. npm install
2. npx patch-package --patch-dir patch
```

### Usage

Furucombo contracts contains three different parts, **Proxy**, **Registry** and **Handler**.

#### Proxy

Proxy is the gateway of every execution. Proxy does not hold any state and should be clean after every execution.

#### Registry

Registry handles the verification for the valid handlers called by proxy, and valid callers calling proxy. Every handler and caller should be registered in Registry and unregistered when deprecated. This is also the only part that requires ownership.
A `halt()` can be executed by owner to halt the validation of handlers and callers from proxy, which is able to halt the execution of proxy.
A `bannedAgent` mapping is maintained to verify if the validation requesting agent is valid.

#### Handler

Handler implements the logic to interact with the external services. Handlers should be treated as libraries, which does not hold states. Handler parameters may apply the execution result of another, for the details please refer to the [Chained Input guideline](CHAINEDINPUT.md).

## Contribute

Please refer to the [contribution guide](CONTRIBUTING.md).

## License

Furucombo is released under the [MIT License](LICENSE).
