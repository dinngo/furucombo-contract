# Certora specifications

Certora specification files appear in this directory (`specs`), while harnesses are under `harnesses` and run scripts of the Certora Prover are in `scripts`. The run scripts are designed to run from within project root directory.

## LibParam
Checked using `libParam.spec`. 
The spec checks that the `LibParam` library functionality doesn't introduce reverts or throws under certain conditions.

## Proxy
Checked using `proxy.spec`.
Contains rules that check integrity of the proxy, which are also applicable to handlers.

## Registry
Checked using `registry.spec`.
Contains rules concerning the ability to execute certain registry functionalities, their scope, and their reversibility.