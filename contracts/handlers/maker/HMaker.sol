pragma solidity ^0.6.0;

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

    modifier cdpAllowed(uint256 cdp) {
        IMakerManager manager = IMakerManager(CDP_MANAGER);
        address owner = manager.owns(cdp);
        address sender = cache.getSender();
        require(
            IDSProxyRegistry(PROXY_REGISTRY).proxies(sender) == owner ||
                manager.cdpCan(owner, cdp, sender) == 1,
            "Unauthorized sender of cdp"
        );
        _;
    }

    function getContractName() public override pure returns (string memory) {
        return "HMaker";
    }

    function openLockETHAndDraw(
        uint256 value,
        address ethJoin,
        address daiJoin,
        bytes32 ilk,
        uint256 wadD
    ) external payable returns (uint256 cdp) {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        cdp = uint256(
            proxy.execute.value(value)(
                PROXY_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "openLockETHAndDraw(address,address,address,address,bytes32,uint256)"
                    0xe685cc04,
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
        bytes32[] memory params = new bytes32[](1);
        params[0] = bytes32(cdp);
        _updatePostProcess(params);
    }

    function openLockGemAndDraw(
        address gemJoin,
        address daiJoin,
        bytes32 ilk,
        uint256 wadC,
        uint256 wadD
    ) external payable returns (uint256 cdp) {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        address token = IMakerGemJoin(gemJoin).gem();
        IERC20(token).safeApprove(address(proxy), wadC);
        cdp = uint256(
            proxy.execute(
                PROXY_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)"
                    0xdb802a32,
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
        bytes32[] memory params = new bytes32[](1);
        params[0] = bytes32(cdp);
        _updatePostProcess(params);
    }

    function safeLockETH(
        uint256 value,
        address ethJoin,
        uint256 cdp
    ) external payable {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        address owner = _getProxy(cache.getSender());
        proxy.execute.value(value)(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "safeLockETH(address,address,uint256,address)"
                0xee284576,
                CDP_MANAGER,
                ethJoin,
                cdp,
                owner
            )
        );
    }

    function safeLockGem(
        address gemJoin,
        uint256 cdp,
        uint256 wad
    ) external payable {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        address owner = _getProxy(cache.getSender());
        address token = IMakerGemJoin(gemJoin).gem();
        IERC20(token).safeApprove(address(proxy), wad);
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "safeLockGem(address,address,uint256,uint256,bool,address)"
                0xead64729,
                CDP_MANAGER,
                gemJoin,
                cdp,
                wad,
                true,
                owner
            )
        );
        IERC20(token).safeApprove(address(proxy), 0);
    }

    function freeETH(
        address ethJoin,
        uint256 cdp,
        uint256 wad
    ) external payable cdpAllowed(cdp) {
        // Check msg.sender authority
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "freeETH(address,address,uint256,uint256)"
                0x7b5a3b43,
                CDP_MANAGER,
                ethJoin,
                cdp,
                wad
            )
        );
    }

    function freeGem(
        address gemJoin,
        uint256 cdp,
        uint256 wad
    ) external payable cdpAllowed(cdp) {
        // Check msg.sender authority
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        address token = IMakerGemJoin(gemJoin).gem();
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "freeGem(address,address,uint256,uint256)"
                0x6ab6a491,
                CDP_MANAGER,
                gemJoin,
                cdp,
                wad
            )
        );

        // Update post process
        _updateToken(token);
    }

    function draw(
        address daiJoin,
        uint256 cdp,
        uint256 wad
    ) external payable cdpAllowed(cdp) {
        // Check msg.sender authority
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "draw(address,address,address,uint256,uint256)"
                0x9f6f3d5b,
                CDP_MANAGER,
                MCD_JUG,
                daiJoin,
                cdp,
                wad
            )
        );

        // Update post process
        _updateToken(DAI_TOKEN);
    }

    function wipe(
        address daiJoin,
        uint256 cdp,
        uint256 wad
    ) external payable {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        IERC20(DAI_TOKEN).safeApprove(address(proxy), wad);
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "wipe(address,address,uint256,uint256)"
                0x4b666199,
                CDP_MANAGER,
                daiJoin,
                cdp,
                wad
            )
        );
        IERC20(DAI_TOKEN).safeApprove(address(proxy), 0);
    }

    function wipeAll(address daiJoin, uint256 cdp) external payable {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        IERC20(DAI_TOKEN).safeApprove(address(proxy), uint256(-1));
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "wipeAll(address,address,uint256)"
                0x036a2395,
                CDP_MANAGER,
                daiJoin,
                cdp
            )
        );
        IERC20(DAI_TOKEN).safeApprove(address(proxy), 0);
    }

    function postProcess() external override payable {
        bytes4 sig = cache.getSig();
        // selector of openLockETHAndDraw(uint256,address,address,bytes32,uint256)
        // and openLockGemAndDraw(address,address,bytes32,uint256,uint256)
        if (sig == 0x5481e4a4 || sig == 0x73af24e7) {
            _transferCdp(uint256(cache.get()));
            uint256 amount = IERC20(DAI_TOKEN).balanceOf(address(this));
            if (amount > 0)
                IERC20(DAI_TOKEN).safeTransfer(cache.getSender(), amount);
        } else revert("Invalid post process");
    }

    function _getProxy(address user) internal returns (address) {
        return IDSProxyRegistry(PROXY_REGISTRY).proxies(user);
    }

    function _transferCdp(uint256 cdp) internal {
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        proxy.execute(
            PROXY_ACTIONS,
            abi.encodeWithSelector(
                // selector of "giveToProxy(address,address,uint256,address)"
                0x493c2049,
                PROXY_REGISTRY,
                CDP_MANAGER,
                cdp,
                cache.getSender()
            )
        );
    }
}
