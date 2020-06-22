pragma solidity ^0.5.0;

import "../HandlerBase.sol";
import "./IComptroller.sol";


contract HComptroller is HandlerBase {
    address constant COMPTROLLER = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;

    function claimComp() external payable {
        IComptroller comptroller = IComptroller(COMPTROLLER);
        comptroller.claimComp(cache.getSender());
    }

    function claimComp(address holder) external payable {
        IComptroller comptroller = IComptroller(COMPTROLLER);
        comptroller.claimComp(holder);
    }
}
