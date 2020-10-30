pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "./IMinter.sol";
import "./ILiquidityGauge.sol";

contract HCurveDao is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public constant CURVE_MINTER = 0xd061D61a4d941c39E5453435B6345Dc261C2fcE0;
    // prettier-ignore
    address public constant CRV_TOKEN = 0xD533a949740bb3306d119CC777fa900bA034cd52;

    function mint(address gauge_addr) external payable returns (uint256) {
        IMinter minter = IMinter(CURVE_MINTER);
        address user = cache.getSender();
        uint256 beforeCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);
        require(
            minter.allowed_to_mint_for(address(this), user),
            "not allowed to mint"
        );

        minter.mint_for(gauge_addr, user);
        uint256 afterCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);

        _updateToken(CRV_TOKEN);
        return afterCRVBalance.sub(beforeCRVBalance);
    }

    function mintMany(address[] calldata gauge_addrs)
        external
        payable
        returns (uint256)
    {
        IMinter minter = IMinter(CURVE_MINTER);
        address user = cache.getSender();
        uint256 beforeCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);
        require(
            minter.allowed_to_mint_for(address(this), user),
            "not allowed to mint"
        );

        for (uint256 i = 0; i < gauge_addrs.length; i++) {
            minter.mint_for(gauge_addrs[i], user);
        }

        _updateToken(CRV_TOKEN);
        return IERC20(CRV_TOKEN).balanceOf(user).sub(beforeCRVBalance);
    }

    function deposit(address gaugeAddress, uint256 _value) external payable {
        ILiquidityGauge gauge = ILiquidityGauge(gaugeAddress);
        address token = gauge.lp_token();
        address user = cache.getSender();

        IERC20(token).safeApprove(gaugeAddress, _value);
        gauge.deposit(_value, user);
        IERC20(token).safeApprove(gaugeAddress, 0);
    }
}
