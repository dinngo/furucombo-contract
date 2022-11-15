// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Utils.sol";
import "contracts/Proxy.sol";
import "contracts/Registry.sol";
import "contracts/FeeRuleRegistry.sol";
import "contracts/handlers/funds/HFunds.sol";
import "contracts/mocks/RuleMock1.sol";
import "contracts/mocks/RuleMock2.sol";

contract FeeTest is Utils {
    uint256 private constant BASE = 1 ether;
    uint256 private constant BASIS_FEE_RATE = 0.01 ether; // 1%
    uint256 private constant RULE1_DISCOUNT = 0.9 ether; // 90% should match DISCOUNT of RuleMock1
    uint256 private constant RULE2_DISCOUNT = 0.8 ether; // 80% should match DISCOUNT of RuleMock2

    HFunds private _hFunds;
    Proxy private _proxy;
    Registry private _registry;
    FeeRuleRegistry private _feeRuleRegistry;
    RuleMock1 private _rule1;
    RuleMock2 private _rule2;

    address private _user;
    address private _collector;
    address private _tokenAddress = DAI_TOKEN;

    IERC20 private _token = IERC20(_tokenAddress);

    function setUp() external {
        _user = _getSigner("user");
        _collector = _getSigner("collector");

        // Handlers related
        _registry = new Registry();
        _hFunds = new HFunds();
        _registry.register(
            address(_hFunds),
            bytes32(abi.encodePacked("Funds"))
        );

        // Fee related
        _feeRuleRegistry = new FeeRuleRegistry(BASIS_FEE_RATE, _collector);
        _rule1 = new RuleMock1(LINK_TOKEN);
        _rule2 = new RuleMock2();
        _feeRuleRegistry.registerRule(address(_rule1));
        _feeRuleRegistry.registerRule(address(_rule2));

        // Deploy proxy
        _proxy = new Proxy(address(_registry), address(_feeRuleRegistry));

        deal(_rule1.token(), _user, 100 ether);
    }

    function testSingleTokenEthFeeCollectorEOA(uint256 ethAmount) external {
        // Use 1b as max value
        ethAmount = bound(ethAmount, 1, 1_000_000_000 ether);
        vm.deal(_user, _user.balance + ethAmount);

        address[] memory tos = new address[](1);
        tos[0] = address(_hFunds);

        bytes32[] memory configs = new bytes32[](1);
        uint256[] memory ruleIndexes = new uint256[](2);
        ruleIndexes[0] = 0;
        ruleIndexes[1] = 1;

        bytes[] memory datas = new bytes[](1);
        datas[0] = abi.encodeWithSelector(_hFunds.send.selector, 0, _user);

        uint256 balanceFeeCollectorBefore = _collector.balance;
        uint256 balanceProxyBefore = address(_proxy).balance;
        uint256 balanceUserBefore = _user.balance;

        // Execution
        vm.prank(_user);
        _proxy.batchExec{value: ethAmount}(tos, configs, datas, ruleIndexes);

        uint256 feeRateUser =
            (BASIS_FEE_RATE * RULE1_DISCOUNT * RULE2_DISCOUNT) / BASE / BASE;

        uint256 feeEth = (ethAmount * feeRateUser) / BASE;

        // Assert
        assertEq(
            _collector.balance - balanceFeeCollectorBefore,
            feeEth,
            "collector balance not equal"
        );
        assertEq(
            address(_proxy).balance - balanceProxyBefore,
            0,
            "proxy balance is not equal"
        );
        assertEq(
            balanceUserBefore - _user.balance,
            feeEth,
            "user balance is not equal"
        );
    }

    function testSingleTokenDAI(uint256 tokenAmount) external {
        tokenAmount = bound(tokenAmount, 1, _token.totalSupply());
        deal(_tokenAddress, _user, tokenAmount);

        address[] memory tos = new address[](1);
        tos[0] = address(_hFunds);

        bytes32[] memory configs = new bytes32[](1);
        uint256[] memory ruleIndexes = new uint256[](2);
        ruleIndexes[0] = 0;
        ruleIndexes[1] = 1;

        address[] memory tokenAddresses = new address[](1);
        tokenAddresses[0] = _tokenAddress;

        uint256[] memory tokenAmounts = new uint256[](1);
        tokenAmounts[0] = tokenAmount;

        bytes[] memory datas = new bytes[](1);
        datas[0] = abi.encodeWithSelector(
            _hFunds.inject.selector,
            tokenAddresses,
            tokenAmounts
        );

        uint256 balanceFeeCollectorBefore = _collector.balance;
        uint256 tokenBalanceFeeCollectorBefore = _token.balanceOf(_collector);

        uint256 balanceProxyBefore = address(_proxy).balance;
        uint256 tokenBalanceProxyBefore = _token.balanceOf(address(_proxy));

        uint256 balanceUserBefore = _user.balance;
        uint256 tokenBalanceUserBefore = _token.balanceOf(_user);

        // Execution
        vm.startPrank(_user);
        _token.approve(address(_proxy), tokenAmount);
        _proxy.batchExec(tos, configs, datas, ruleIndexes);
        vm.stopPrank();

        // Split into lines to avoid stack too deep issue
        uint256 rate = (BASIS_FEE_RATE * RULE1_DISCOUNT) / BASE;
        rate = (rate * RULE2_DISCOUNT) / BASE;
        uint256 feeToken = (tokenAmount * rate);
        feeToken = feeToken / BASE;

        // Assert
        // Fee collector
        assertEq(
            _collector.balance,
            balanceFeeCollectorBefore,
            "collector balance is not equal"
        );
        assertEq(
            _token.balanceOf(_collector) - tokenBalanceFeeCollectorBefore,
            feeToken,
            "collector token balance is not equal"
        );
        // Proxy
        assertEq(
            address(_proxy).balance,
            balanceProxyBefore,
            "proxy balance is not equal"
        );
        assertEq(
            _token.balanceOf(address(_proxy)),
            tokenBalanceProxyBefore,
            "proxy token balance is not equal"
        );
        // User
        assertEq(balanceUserBefore, _user.balance, "user balance is not equal");
        assertEq(
            _token.balanceOf(_user),
            tokenBalanceUserBefore - feeToken,
            "user token balance is not equal"
        );
    }
}
