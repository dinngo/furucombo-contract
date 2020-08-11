pragma solidity ^0.5.0;

import "../HandlerBase.sol";
import "./IMinter.sol";
import "./ILiquidityGauge.sol";


contract HCurveDao is HandlerBase {
    address public constant CURVE_MINTER = address(0);
    address public constant CRV_TOKEN = address(0);

    function mint_for(address gauge_addr, address _for) external payable {
        IMinter minter = IMinter(CURVE_MINTER);
        minter.mint_for(gauge_addr, _for);

        _updateToken(CRV_TOKEN);
    }

    function mint_for_many(address[] calldata gauge_addrs, address _for)
        external
        payable
    {
        IMinter minter = IMinter(CURVE_MINTER);

        for (uint256 i = 0; i < gauge_addrs.length; i++) {
            minter.mint_for(gauge_addrs[i], _for);
        }

        _updateToken(CRV_TOKEN);
    }

    function deposit(address gaugeAddress, uint256 _value) external payable {
        ILiquidityGauge gauge = ILiquidityGauge(gaugeAddress);
        IERC20 token = gauge.lp_token();

        address user = cache.getSender();
        IERC20(token).safeApprove(gaugeAddress, _value);
        gauge.deposit(_value, user);
        IERC20(token).safeApprove(gaugeAddress, 0);
    }
}
