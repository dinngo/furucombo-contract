pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IMerkleRedeem {
    struct Claim {
        uint256 week;
        uint256 balance;
        bytes32[] merkleProof;
    }
    function token() external view returns (address);
    function claimWeeks(address, Claim[] calldata) external;
}
