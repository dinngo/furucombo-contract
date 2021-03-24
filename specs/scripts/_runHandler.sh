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

handler_file=contracts/handlers/${dir}/${handler}.sol

perl -0777 -i -pe 's/function _revertMsg\(string memory functionName, string memory reason\)\s*internal/function _revertMsg\(string memory functionName, string memory reason\) virtual internal/g' contracts/handlers/HandlerBase.sol
perl -0777 -i -pe 's/is HandlerBase {/is HandlerBase {
    function getSlot\(uint s\) external view returns \(uint x\) {
        assembly { x := sload\(s\) }
    }

    function getStackLength\(\) external view returns \(uint\) { return stack.length; }

    function getSender\(\) public returns \(address\) { return \_getSender\(\); }

    function _revertMsg(string memory functionName, string memory reason)
        internal override
        view {
            revert();
        }
/g' ${handler_file}
perl -0777 -i -pe 's/SafeERC20.sol/ERC20.sol/g' ${handler_file}
perl -0777 -i -pe 's/safeA/a/g' ${handler_file}
perl -0777 -i -pe 's/safeT/t/g' ${handler_file}

certoraRun ${handler_file} contracts/Registry.sol specs/harnesses/DummyERC20A.sol specs/harnesses/ProxyHarness.sol \
    --verify ${handler}:${spec} \
    --settings -assumeUnwindCond,-b=${B} \
    --cache "handler${handler}" \
    --msg "Handler ${handler}"