#!/bin/bash
function usage {
    echo "_runHandler.sh HANDLER_NAME CONTAINING_DIR SPEC_FILE_PATH"
    exit 1
}

if [ -z "$1" ] 
then
    echo "Missing handler name"
    usage
fi

if [ -z "$2" ] 
then
    echo "Missing containing directory name"
    usage
fi

if [ -z "$3" ] 
then
    echo "Missing spec file path"
    usage
fi

handler=$1
dir=$2
spec=$3
B=2
certoraRun contracts/handlers/${dir}/${handler}.sol contracts/Registry.sol specs/harnesses/DummyERC20A.sol specs/harnesses/ProxyHarness.sol \
    --verify ${handler}:${spec} \
    --settings -assumeUnwindCond,-b=${B} \
    --cache "handler${handler}" \
    --msg "Handler ${handler}"