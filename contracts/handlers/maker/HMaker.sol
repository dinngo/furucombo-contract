pragma solidity ^0.5.0;

import "./IDSProxy.sol";
import "./IMaker.sol";
import "../HandlerBase.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract HMaker is HandlerBase {
    using SafeERC20 for IERC20;

    address constant PROXY_ACTIONS = 0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038;
    address constant CDP_MANAGER = 0x5ef30b9986345249bc32d8928B7ee64DE9435E39;
    address constant PROXY_REGISTRY = 0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4;
    address constant MCD_JUG = 0x19c0976f590D67707E62397C87829d896Dc0f1F1;
    address constant DAI_TOKEN = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    function openLockETHAndDraw(
        uint256 value,
        address ethJoin,
        address daiJoin,
        bytes32 ilk,
        uint256 wadD
    ) public payable returns (uint256 cdp) {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        cdp = uint256(
            proxy.execute.value(value)(
                PROXY_ACTIONS,
                abi.encodeWithSignature(
                    "openLockETHAndDraw(address,address,address,address,bytes32,uint256)",
                    CDP_MANAGER,
                    MCD_JUG,
                    ethJoin,
                    daiJoin,
                    ilk,
                    wadD
                )
            )
        );

        // Update post process
        bytes32[] memory params = new bytes32[](2);
        params[0] = bytes32(cdp);
        params[1] = bytes32(wadD);
        _updatePostProcess(params);
    }

    function openLockGemAndDraw(
        address gemJoin,
        address daiJoin,
        bytes32 ilk,
        uint256 wadC,
        uint256 wadD
    ) public payable returns (uint256 cdp) {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        address token = IMakerGemJoin(gemJoin).gem();
        IERC20(token).safeApprove(address(proxy), wadC);
        cdp = uint256(
            proxy.execute(
                PROXY_ACTIONS,
                abi.encodeWithSignature(
                    "openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)",
                    CDP_MANAGER,
                    MCD_JUG,
                    gemJoin,
                    daiJoin,
                    ilk,
                    wadC,
                    wadD,
                    true
                )
            )
        );
        IERC20(token).safeApprove(address(proxy), 0);

        // Update post process
        bytes32[] memory params = new bytes32[](2);
        params[0] = bytes32(cdp);
        params[1] = bytes32(wadD);
        _updatePostProcess(params);
    }

    function postProcess() external payable {
        bytes4 sig = cache.getSig();
        if (
            sig ==
            bytes4(
                keccak256(
                    bytes(
                        "openLockETHAndDraw(uint256,address,address,bytes32,uint256)"
                    )
                )
            ) ||
            sig ==
            bytes4(
                keccak256(
                    bytes(
                        "openLockGemAndDraw(address,address,bytes32,uint256,uint256)"
                    )
                )
            )
        ) {
            _transferCdp(uint256(cache.get()));
            IERC20(DAI_TOKEN).safeTransfer(msg.sender, uint256(cache.get()));
        } else revert("Invalid post process");
    }

    function _getProxy(address user) internal returns (address) {
        return IDSProxyRegistry(PROXY_REGISTRY).proxies(user);
    }

    function _transferCdp(uint256 cdp) internal {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSignature(
                "giveToProxy(address,address,uint256,address)",
                PROXY_REGISTRY,
                CDP_MANAGER,
                cdp,
                msg.sender
            )
        );
    }
}
