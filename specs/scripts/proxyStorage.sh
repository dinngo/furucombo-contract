#!/bin/bash
if [ -z "$1" ] 
then
    echo "missing description"
    exit 1
fi
B=2
certoraRun specs/harnesses/ProxyHarness.sol contracts/Registry.sol \
    --verify ProxyHarness:specs/proxyStorage.spec \
    --settings -assumeUnwindCond,-b=$B \
    --msg "Proxy - check storage writes - $B unroll - $1"