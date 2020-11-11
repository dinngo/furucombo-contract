pragma solidity ^0.5.0;


interface IMerkleRedeem {
    struct Claim {
        uint256 week;
        uint256 balance;
        bytes32[] merkleProof;
    }
    function token() external view returns (address);


}
