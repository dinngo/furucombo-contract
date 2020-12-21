pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IATokenV2.sol";
import "./ILendingPoolV2.sol";
import "./ILendingPoolAddressesProviderV2.sol";
import "./libraries/DataTypes.sol";
// import "./FlashLoanReceiverBaseV2.sol";
// import "../../interface/IProxy.sol";
import "../HandlerBase.sol";

contract HAaveProtocolV2 is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public constant PROVIDER = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
    uint16 public constant REFERRAL_CODE = 56;

    function getContractName() public pure override returns (string memory) {
        return "HAaveProtocolV2";
    }

    function deposit(address asset, uint256 amount) external payable {
        (address pool, address aToken) = _getLendingPoolAndAToken(asset);
        IERC20(asset).safeApprove(pool, amount);

        try
            ILendingPoolV2(pool).deposit(
                asset,
                amount,
                address(this),
                REFERRAL_CODE
            )
        {} catch Error(string memory reason) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }

        IERC20(asset).safeApprove(pool, 0);
        _updateToken(aToken);
    }

    function withdraw(address asset, uint256 amount)
        external
        payable
        returns (uint256 withdrawAmount)
    {
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();

        try
            ILendingPoolV2(pool).withdraw(asset, amount, address(this))
        returns (uint256 ret) {
            withdrawAmount = ret;
        } catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }

        _updateToken(asset);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external payable returns (uint256 repayAmount) {
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();
        IERC20(asset).safeApprove(pool, amount);

        try
            ILendingPoolV2(pool).repay(asset, amount, rateMode, onBehalfOf)
        returns (uint256 ret) {
            repayAmount = ret;
        } catch Error(string memory reason) {
            _revertMsg("repay", reason);
        } catch {
            _revertMsg("repay");
        }

        IERC20(asset).safeApprove(pool, 0);
    }

    function _getLendingPoolAndAToken(address underlying)
        internal
        view
        returns (address pool, address aToken)
    {
        pool = ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();
        try ILendingPoolV2(pool).getReserveData(underlying) returns (
            DataTypes.ReserveData memory data
        ) {
            aToken = data.aTokenAddress;
            if (aToken == address(0))
                _revertMsg("General", "aToken should not be zero address");
        } catch Error(string memory reason) {
            _revertMsg("General", reason);
        } catch {
            _revertMsg("General");
        }
    }
}
