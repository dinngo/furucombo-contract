pragma solidity >=0.5.0;

interface IMooniswap {
    function deposit(uint256[] calldata, uint256[] calldata) external payable returns(uint256);
    function withdraw(uint256, uint256[] calldata) external;
    function getTokens() external view returns(address[] memory);
}
