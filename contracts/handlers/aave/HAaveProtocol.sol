pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ILendingPool.sol";
import "./ILendingPoolAddressesProvider.sol";
import "./FlashLoanReceiverBase.sol";
import "../HandlerBase.sol";

interface IProxy {
    function execs(address[] calldata tos, bytes[] calldata datas) external;
}

contract HAaveProtocol is HandlerBase, FlashLoanReceiverBase {
    using SafeERC20 for IERC20;

    function flashLoan(
        address _reserve,
        uint256 _amount,
        bytes calldata _params
    ) external payable {
        ILendingPool lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(PROVIDER).getLendingPool()
        );
        lendingPool.flashLoan(address(this), _reserve, _amount, _params);

        // Update involved token
        if (_reserve != ETHADDRESS)
            _updateToken(_reserve);
    }

    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    ) external payable {
        (address[] memory tos, bytes[] memory datas) = abi.decode(
            _params, (address[], bytes[])
        );
        IProxy(address(this)).execs(tos, datas);
        transferFundsBackToPoolInternal(_reserve, _amount.add(_fee));
    }
}
