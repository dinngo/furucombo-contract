#!/bin/bash
function usage {
    echo "_runHandler.sh HANDLER_NAME CONTAINING_DIR SPEC_FILE_PATH [UNROLL_FACTOR]"
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

if [ -z "$4" ]
then
    B=2
else
    B=$4
fi

handler=$1
dir=$2
spec=$3

handler_file=contracts/handlers/${dir}/${handler}.sol

perl -0777 -i -pe 's/function _revertMsg\(string memory functionName, string memory reason\)\s*internal/function _revertMsg\(string memory functionName, string memory reason\) virtual internal/g' contracts/handlers/HandlerBase.sol
perl -0777 -i -pe 's/is HandlerBase(, [a-zA-Z0-9]+)* \{\s*using/is HandlerBase\1 {
    function getSlot\(uint s\) external view returns \(uint x\) {
        assembly { x := sload\(s\) }
    }

    function getStackLengthSlot\(\) external view returns \(uint x\) {
        assembly { x := stack_slot }
    }

    function getStackLength\(\) external view returns \(uint\) { return stack.length; }

    function getSender\(\) public returns \(address\) { return \_getSender\(\); }
    function getCubeCounter\(\) public returns \(uint256\) { return \_getCubeCounter\(\); }

    function ethBalance\(address who\) external view returns \(uint\) {
        return who.balance;
    }

    \/\/ to distinguish handlers from proxy
    function isHandler\(\) public returns \(bool\) { return true; }

    function _revertMsg(string memory functionName, string memory reason)
        internal override
        view {
            revert();
        }

    using    
/g' ${handler_file}
perl -0777 -i -pe 's/SafeERC20.sol/ERC20.sol/g' ${handler_file}
perl -0777 -i -pe 's/safeA/a/g' ${handler_file}
perl -0777 -i -pe 's/safeT/t/g' ${handler_file}
perl -0777 -i -pe 's/address public constant /address public /g' ${handler_file}
perl -0777 -i -pe 's/address payable public constant / address payable public /g' ${handler_file}
perl -0777 -i -pe 's/dsProxyPayable.transfer\(amount\)/Nothing\(dsProxyPayable\).nop{value:amount}\(\)/g' ${handler_file}

# handler specific
perl -0777 -i -pe 's/function repay\(/function unique_repay\(/g' contracts/handlers/aavev2/HAaveProtocolV2.sol
perl -0777 -i -pe 's/function claimComp\(/function unique_claimComp\(/g' contracts/handlers/compound/HSCompound.sol
perl -0777 -i -pe 's/receiver.transfer\(amount\)/Nothing\(receiver\).nop{value:amount}\(\)/g' contracts/handlers/funds/HFunds.sol

certoraRun ${handler_file} contracts/Registry.sol specs/harnesses/DummyERC20A.sol specs/harnesses/ProxyHarness.sol specs/harnesses/Summary.sol \
    --verify ${handler}:${spec} \
    --settings -assumeUnwindCond,-b=${B} \
    --cache "handler${handler}" \
    --staging shelly/furucomboTypeRewriterIssue --msg "Handler ${handler}" --javaArgs '"-Dtopic.tac.type.checker -Dtopic.function.builder -Dtopic.decompiler"'
