# Exit script as soon as a command fails.
# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
    # kill the ganache instance that we started (if we started one and if it's still running).
    if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
        kill -9 $ganache_pid
    fi
}

ganache_port=8545

ganache_running() {
    nc -z localhost "$ganache_port"
}

start_ganache() {
    TEST_MNEMONIC_PHRASE="dice shove sheriff police boss indoor hospital vivid tenant method game matter"
    ETHER_PROVIDER="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    DAI_PROVIDER="0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667"
    MKR_PROVIDER="0x8EE7D9235e01e6B42345120b5d270bdB763624C7"
    BAT_PROVIDER="0x2e642b8d59b45a1d8c5aef716a84ff44ea665914"
    USDT_PROVIDER="0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3"
    SUSD_PROVIDER="0x49BE88F0fcC3A8393a59d3688480d7D253C37D2A"
    WBTC_PROVIDER="0xA910f92ACdAf488fa6eF02174fb86208Ad7722ba"
    KNC_PROVIDER="0x3EB01B3391EA15CE752d01Cf3D3F09deC596F650"
    WETH_PROVIDER="0x57757e3d981446d585af0d9ae4d7df6d64647806"
    RENBTC_PROVIDER="0x944644Ea989Ec64c2Ab9eF341D383cEf586A5777"
    YCRV_PROVIDER="0xc447fcaf1def19a583f97b3620627bf69c05b5fb"
    TCRV_PROVIDER="0xc447fcaf1def19a583f97b3620627bf69c05b5fb"
    YFI_PROVIDER="0xbe0eb53f46cd790cd13851d5eff43d12404d33e8"
    ALINK_PROVIDER="0xB1AdceddB2941033a090dD166a462fe1c2029484"
    CURVE_SBTCCRV_PROVIDER="0x15Bf9a8De0e56112eE0fCF85e3c4e54FB22346DC"
    CHI_PROVIDER="0x5B1fC2435B1f7C16c206e7968C0e8524eC29b786"
    GST2_PROVIDER="0xDB73875FB771b95d6FECf967c00E00862c133F32"
    MUSD_PROVIDER="0xa0f75491720835b36edC92D06DDc468D201e9b73"
    COMBO_CLAIM_USER="0x1b57b3A1d5b4aa8E218F54FafB00975699463e6e"
    CURVE_MUSDCRV_PROVIDER="0x272f5da6c5b5b798d6753d74605fdd104726c474"
    BALANCER_DAI_ETH_PROVIDER="0xf56D610cbF3208FF6F009Cb740BEFf4E9EF4d7ad"
    SETH_PROVIDER="0xe9cf7887b93150d4f2da7dfc6d502b216438f244"
    CURVE_SETHCRV_PROVIDER="0x0226c05fBb787A805154cF7e052104Fa86E13F46"
    CURVE_AAVECRV_PROVIDER="0x310D5C8EE1512D5092ee4377061aE82E48973689"
    CURVE_SCRV_PROVIDER="0x59CE4a2AC5bC3f5F225439B2993b86B42f6d3e9F"
    SNX_PROVIDER="0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
    STAKING_REWARDS_ADAPTER_REGISTRY_OWNER="0xa7248f4b85fb6261c314d08e7938285d1d86cd61"
    HBTC_PROVIDER="0x24d48513eac38449ec7c310a79584f87785f856f"
    OMG_PROVIDER="0x23735750a6ed0119e778d9bb969137df8cc8c3d1"

    # node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff -m "$TEST_MNEMONIC_PHRASE" > /dev/null &
    node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff --debug -f $ETH_MAINNET_NODE -m "$TEST_MNEMONIC_PHRASE" -u "$ETHER_PROVIDER" -u "$DAI_PROVIDER" -u "$MKR_PROVIDER" -u "$BAT_PROVIDER" -u "$USDT_PROVIDER" -u "$SUSD_PROVIDER" -u "$WBTC_PROVIDER" -u "$KNC_PROVIDER" -u "$WETH_PROVIDER" -u "$RENBTC_PROVIDER" -u "$YCRV_PROVIDER" -u "$TCRV_PROVIDER" -u "$YFI_PROVIDER" -u "$ALINK_PROVIDER" -u "$CURVE_SBTCCRV_PROVIDER" -u "$CHI_PROVIDER" -u "$GST2_PROVIDER" -u "$MUSD_PROVIDER" -u "$CURVE_MUSDCRV_PROVIDER" -u "$BALANCER_DAI_ETH_PROVIDER" -u "$COMBO_CLAIM_USER" -u "$SETH_PROVIDER" -u "$CURVE_SETHCRV_PROVIDER" -u "$CURVE_AAVECRV_PROVIDER" -u "$CURVE_SCRV_PROVIDER" -u "$SNX_PROVIDER" -u "$HBTC_PROVIDER" -u "$OMG_PROVIDER" -u "$STAKING_REWARDS_ADAPTER_REGISTRY_OWNER" > /dev/null &

    ganache_pid=$!
}

if ganache_running; then
    echo "Using existing ganache instance"
else
    echo "Starting new ganache instance"
    start_ganache
fi

truffle version

# Execute rest test files with suffix `.test.js` with single `truffle test`
node_modules/.bin/truffle test "$@"
