pragma solidity ^0.5.0;

interface IMinter {
    function mint_for(address gauge_addr, address _for) external;
}
