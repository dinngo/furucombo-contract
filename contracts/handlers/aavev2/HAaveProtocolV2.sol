// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interface/IProxy.sol";
import "../HandlerBase.sol";
import "../weth/IWETH9.sol";
import "./ILendingPoolV2.sol";
import "./IFlashLoanReceiver.sol";
import "./ILendingPoolAddressesProviderV2.sol";
import "./libraries/DataTypes.sol";

contract HAaveProtocolV2 is HandlerBase, IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant PROVIDER = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
    // prettier-ignore
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    // prettier-ignore
    address public constant ETHER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint16 public constant REFERRAL_CODE = 56;

    function getContractName() public pure override returns (string memory) {
        return "HAaveProtocolV2";
    }

    function deposit(address asset, uint256 amount) external payable {
        amount = _getBalance(asset, amount);
        _deposit(asset, amount);
    }

    function depositETH(uint256 amount) external payable {
        amount = _getBalance(ETHER, amount);
        IWETH9(WETH).deposit{value: amount}();
        _deposit(WETH, amount);

        _updateToken(WETH);
    }

    function withdraw(address asset, uint256 amount)
        external
        payable
        returns (uint256 withdrawAmount)
    {
        withdrawAmount = _withdraw(asset, amount);

        _updateToken(asset);
    }

    function withdrawETH(uint256 amount)
        external
        payable
        returns (uint256 withdrawAmount)
    {
        withdrawAmount = _withdraw(WETH, amount);
        IWETH9(WETH).withdraw(withdrawAmount);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external payable returns (uint256 remainDebt) {
        remainDebt = _repay(asset, amount, rateMode, onBehalfOf);
    }

    function repayETH(
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external payable returns (uint256 remainDebt) {
        IWETH9(WETH).deposit{value: amount}();
        remainDebt = _repay(WETH, amount, rateMode, onBehalfOf);

        _updateToken(WETH);
    }

    function borrow(
        address asset,
        uint256 amount,
        uint256 rateMode
    ) external payable {
        address onBehalfOf = _getSender();
        _borrow(asset, amount, rateMode, onBehalfOf);
        _updateToken(asset);
    }

    function borrowETH(uint256 amount, uint256 rateMode) external payable {
        address onBehalfOf = _getSender();
        _borrow(WETH, amount, rateMode, onBehalfOf);
        IWETH9(WETH).withdraw(amount);
    }

    function flashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        bytes calldata params
    ) external payable {
        _requireMsg(
            assets.length == amounts.length,
            "flashLoan",
            "assets and amounts do not match"
        );

        _requireMsg(
            assets.length == modes.length,
            "flashLoan",
            "assets and modes do not match"
        );

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
        address[] memory assets,
        uint256[] memory amounts,
        uint256[] memory premiums,
        address initiator,
        bytes memory params
    ) external override returns (bool) {
        _requireMsg(
            msg.sender ==
                ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool(),
            "executeOperation",
            "invalid caller"
        );

        _requireMsg(
            initiator == address(this),
            "executeOperation",
            "not initiated by the proxy"
        );

        (address[] memory tos, bytes32[] memory configs, bytes[] memory datas) =
            abi.decode(params, (address[], bytes32[], bytes[]));
        IProxy(address(this)).execs(tos, configs, datas);

        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwing = amounts[i] + premiums[i];
            IERC20(assets[i]).safeApprove(pool, amountOwing);
        }
        return true;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _deposit(address asset, uint256 amount) internal {
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

    function _withdraw(address asset, uint256 amount)
        internal
        returns (uint256 withdrawAmount)
    {
        (address pool, address aToken) = _getLendingPoolAndAToken(asset);
        amount = _getBalance(aToken, amount);

        try
            ILendingPoolV2(pool).withdraw(asset, amount, address(this))
        returns (uint256 ret) {
            withdrawAmount = ret;
        } catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }
    }

    function _repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) internal returns (uint256 remainDebt) {
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();
        IERC20(asset).safeApprove(pool, amount);

        try
            ILendingPoolV2(pool).repay(asset, amount, rateMode, onBehalfOf)
        {} catch Error(string memory reason) {
            _revertMsg("repay", reason);
        } catch {
            _revertMsg("repay");
        }

        IERC20(asset).safeApprove(pool, 0);

        DataTypes.ReserveData memory reserve =
            ILendingPoolV2(pool).getReserveData(asset);
        remainDebt = DataTypes.InterestRateMode(rateMode) ==
            DataTypes.InterestRateMode.STABLE
            ? IERC20(reserve.stableDebtTokenAddress).balanceOf(onBehalfOf)
            : IERC20(reserve.variableDebtTokenAddress).balanceOf(onBehalfOf);
    }

    function _borrow(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) internal {
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDER).getLendingPool();

        try
            ILendingPoolV2(pool).borrow(
                asset,
                amount,
                rateMode,
                REFERRAL_CODE,
                onBehalfOf
            )
        {} catch Error(string memory reason) {
            _revertMsg("borrow", reason);
        } catch {
            _revertMsg("borrow");
        }
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
            _requireMsg(
                aToken != address(0),
                "General",
                "aToken should not be zero address"
            );
        } catch Error(string memory reason) {
            _revertMsg("General", reason);
        } catch {
            _revertMsg("General");
        }
    }
}
