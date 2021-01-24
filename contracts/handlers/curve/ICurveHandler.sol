pragma solidity ^0.6.0;

interface ICurveHandler {
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external payable;

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external;

    // Curve contract only support static array
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount)
        external;

    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount)
        external;

    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount)
        external;

    function add_liquidity(uint256[5] calldata amounts, uint256 min_mint_amount)
        external;

    function add_liquidity(uint256[6] calldata amounts, uint256 min_mint_amount)
        external;

    function calc_token_amount(uint256[2] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function calc_token_amount(uint256[3] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function calc_token_amount(uint256[4] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function calc_token_amount(uint256[5] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function calc_token_amount(uint256[6] calldata amounts, bool deposit)
        external
        view
        returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_amount
    ) external;

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
