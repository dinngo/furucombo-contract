pragma solidity ^0.5.0;

// Curve compound, y, busd, pax and susd pools have this wrapped contract called
// deposit used to manipulate liquidity.
interface ICurveDeposit {
    function underlying_coins(int128 arg0) external view returns (address);

    function token() external view returns (address);

    // compound pool
    function add_liquidity(
        uint256[2] calldata uamounts,
        uint256 min_mint_amount
    ) external;

    // usdt(deprecated) pool
    function add_liquidity(
        uint256[3] calldata uamounts,
        uint256 min_mint_amount
    ) external;

    // y, busd and pax pools
    function add_liquidity(
        uint256[4] calldata uamounts,
        uint256 min_mint_amount
    ) external;

    // compound, y, busd, pax and susd pools
    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_uamount,
        bool donate_dust
    ) external;

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i)
        external
        view
        returns (uint256);
}
