pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "./ILendingPoolCore.sol";
import "./ILendingPoolAddressesProvider.sol";
import "./FlashLoanReceiverBase.sol";
import "../HandlerBase.sol";
import "../../interface/IProxy.sol";

contract HAaveProtocol is HandlerBase, FlashLoanReceiverBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint16 public constant REFERRAL_CODE = 56;

    function getContractName() public override pure returns (string memory) {
        return "HAaveProtocol";
    }

    function flashLoan(
        address _reserve,
        uint256 _amount,
        bytes calldata _params
    ) external payable {
        ILendingPool lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(PROVIDER).getLendingPool()
        );
        try
            lendingPool.flashLoan(address(this), _reserve, _amount, _params)
         {} catch Error(string memory reason) {
            _revertMsg("flashLoan", reason);
        } catch {
            _revertMsg("flashLoan");
        }

        // Update involved token
        if (_reserve != ETHADDRESS) _updateToken(_reserve);
    }

    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    ) external payable {
        (
            address[] memory tos,
            bytes32[] memory configs,
            bytes[] memory datas
        ) = abi.decode(_params, (address[], bytes32[], bytes[]));
        IProxy(address(this)).execs(tos, configs, datas);
        transferFundsBackToPoolInternal(_reserve, _amount.add(_fee));
    }

    function deposit(address _reserve, uint256 _amount)
        external
        payable
        returns (uint256 aTokenAmount)
    {
        ILendingPool lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(PROVIDER).getLendingPool()
        );

        // Get AToken before depositing
        address aToken = _getAToken(_reserve);
        uint256 beforeATokenBalance = IERC20(aToken).balanceOf(address(this));

        if (_reserve == ETHADDRESS) {
            try
                lendingPool.deposit.value(_amount)(
                    _reserve,
                    _amount,
                    REFERRAL_CODE
                )
             {} catch Error(string memory reason) {
                _revertMsg("deposit", reason);
            } catch {
                _revertMsg("deposit");
            }
        } else {
            address lendingPoolCore = ILendingPoolAddressesProvider(PROVIDER)
                .getLendingPoolCore();
            IERC20(_reserve).safeApprove(lendingPoolCore, _amount);
            try
                lendingPool.deposit(_reserve, _amount, REFERRAL_CODE)
             {} catch Error(string memory reason) {
                _revertMsg("deposit", reason);
            } catch {
                _revertMsg("deposit");
            }
            IERC20(_reserve).safeApprove(lendingPoolCore, 0);
        }

        // Get AToken after depositing
        uint256 afterATokenBalance = IERC20(aToken).balanceOf(address(this));
        _updateToken(aToken);
        return (afterATokenBalance.sub(beforeATokenBalance));
    }

    function redeem(address _aToken, uint256 _amount)
        external
        payable
        returns (uint256 underlyingAssetAmount)
    {
        // Get proxy balance before redeem
        uint256 beforeUnderlyingAssetAmount;
        address underlyingAsset = IAToken(_aToken).underlyingAssetAddress();
        if (underlyingAsset != ETHADDRESS) {
            beforeUnderlyingAssetAmount = IERC20(underlyingAsset).balanceOf(
                address(this)
            );
        } else {
            beforeUnderlyingAssetAmount = address(this).balance;
        }

        // Call redeem function
        try IAToken(_aToken).redeem(_amount)  {} catch Error(
            string memory reason
        ) {
            _revertMsg("redeem", reason);
        } catch {
            _revertMsg("redeem");
        }

        // Get redeem amount and update token
        uint256 afterUnderlyingAssetAmount;
        if (underlyingAsset != ETHADDRESS) {
            afterUnderlyingAssetAmount = IERC20(underlyingAsset).balanceOf(
                address(this)
            );
            _updateToken(underlyingAsset);
        } else {
            afterUnderlyingAssetAmount = address(this).balance;
        }

        return (afterUnderlyingAssetAmount.sub(beforeUnderlyingAssetAmount));
    }

    function _getAToken(address _reserve) internal view returns (address) {
        ILendingPoolCore lendingPoolCore = ILendingPoolCore(
            ILendingPoolAddressesProvider(PROVIDER).getLendingPoolCore()
        );
        try lendingPoolCore.getReserveATokenAddress(_reserve) returns (
            address aToken
        ) {
            if (aToken == address(0))
                _revertMsg("General", "aToken should not be zero address");
            else return aToken;
        } catch Error(string memory reason) {
            _revertMsg("General", reason);
        } catch {
            _revertMsg("General");
        }
    }
}
