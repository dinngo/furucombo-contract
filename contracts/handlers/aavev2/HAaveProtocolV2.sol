pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../interface/IProxy.sol";
import "../HandlerBase.sol";
import "./ILendingPoolV2.sol";
import "./IFlashLoanReceiver.sol";
import "./ILendingPoolAddressesProviderV2.sol";

contract HAaveProtocolV2 is HandlerBase, IFlashLoanReceiver {
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

    function flashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        bytes calldata params
    ) external payable {
        if (assets.length != amounts.length) {
            _revertMsg("flashLoan", "assets and amounts do not match");
        }

        if (assets.length != modes.length) {
            _revertMsg("flashLoan", "assets and modes do not match");
        }

        address onBehalfOf = _getSender();
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();

        try
            ILendingPoolV2(pool).flashLoan(
                address(this),
                assets,
                amounts,
                modes,
                onBehalfOf,
                params,
                REFERRAL_CODE
            )
        {} catch Error(string memory reason) {
            _revertMsg("flashLoan", reason);
        } catch {
            _revertMsg("flashLoan");
        }

        // approve lending pool zero
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20(assets[i]).safeApprove(pool, 0);
            if (modes[i] != 0) _updateToken(assets[i]);
        }
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (initiator != address(this)) {
            _revertMsg("executeOperation", "not initiated by the proxy");
        }

        (address[] memory tos, bytes32[] memory configs, bytes[] memory datas) =
            abi.decode(params, (address[], bytes32[], bytes[]));
        IProxy(address(this)).execs(tos, configs, datas);

        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwing = amounts[i].add(premiums[i]);

            // compile error: Stack too deep, try removing local variables, when using safeApprove
            // allows lending pool transferFrom token from address(this) for paying back
            IERC20(assets[i]).approve(pool, amountOwing);
        }

        return true;
    }
}
