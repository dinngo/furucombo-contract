#!/bin/sh

# Exit script as soon as a command fails.
set -o errexit

forge test --fork-url ${ETH_RPC_URL} -vvv
