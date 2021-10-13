# Exit script as soon as a command fails.
# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
    # kill the hardhat instance that we started (if we started one and if it's still running).
    if [ -n "$hardhat_pid" ] && ps -p $hardhat_pid > /dev/null; then
        kill -9 $hardhat_pid
    fi
}

hardhat_port=8545

hardhat_running() {
    nc -z localhost "$hardhat_port"
}

# if action=migration, will executed deployment script, act like truffle migration.

# shift $2 to $1, $3 to $2, etc.
# shift

# unit test to be executed
# tests="${@:2}"
tests="$@"
echo "running tests:"
echo "$tests"

start_hardhat() {
    TEST_MNEMONIC_PHRASE="dice shove sheriff police boss indoor hospital vivid tenant method game matter"
    ETHER_PROVIDER="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    DAI_PROVIDER="0x5A16552f59ea34E44ec81E58b3817833E9fD5436"
    MKR_PROVIDER="0x05E793cE0C6027323Ac150F6d45C2344d28B6019"
    BAT_PROVIDER="0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"
    USDT_PROVIDER="0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3"
    SUSD_PROVIDER="0x49BE88F0fcC3A8393a59d3688480d7D253C37D2A"
    WBTC_PROVIDER="0xA910f92ACdAf488fa6eF02174fb86208Ad7722ba"
    KNC_PROVIDER="0xf60c2Ea62EDBfE808163751DD0d8693DCb30019c"
    WETH_PROVIDER="0x57757e3d981446d585af0d9ae4d7df6d64647806"
    RENBTC_PROVIDER="0x35fFd6E268610E764fF6944d07760D0EFe5E40E5"
    YCRV_PROVIDER="0x77D3C47876e45123C2837Ba68720378Af00a2C0A"
    TCRV_PROVIDER="0x9Ed20e8AA8A38A2ED8BeC500c438575cb222d0B6"
    YFI_PROVIDER="0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
    ALINK_PROVIDER="0xC3B2FC58A3A54739E303B5E7c53Bd6021d1d56dD"
    CURVE_SBTCCRV_PROVIDER="0xb6cc645f753be83c9ee6d085adf72cdca22658b5"
    CHI_PROVIDER="0x5B1fC2435B1f7C16c206e7968C0e8524eC29b786"
    GST2_PROVIDER="0xDB73875FB771b95d6FECf967c00E00862c133F32"
    MUSD_PROVIDER="0x11eDedebF63bef0ea2d2D071bdF88F71543ec6fB"
    COMBO_CLAIM_USER="0x1b57b3A1d5b4aa8E218F54FafB00975699463e6e"
    CURVE_MUSDCRV_PROVIDER="0x86b0096908bD5a5970204A07f0e71b2CEb07B218"
    BALANCER_DAI_ETH_PROVIDER="0xf56D610cbF3208FF6F009Cb740BEFf4E9EF4d7ad"
    SETH_PROVIDER="0xe9cf7887b93150d4f2da7dfc6d502b216438f244"
    CURVE_SETHCRV_PROVIDER="0x1FbF5955b35728E650b56eF48eE9f3BD020164c8"
    CURVE_AAVECRV_PROVIDER="0x310D5C8EE1512D5092ee4377061aE82E48973689"
    CURVE_SCRV_PROVIDER="0x1f9bB27d0C66fEB932f3F8B02620A128d072f3d8"
    SNX_PROVIDER="0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2"
    STAKING_REWARDS_ADAPTER_REGISTRY_OWNER="0xa7248f4b85fb6261c314d08e7938285d1d86cd61"
    HBTC_PROVIDER="0x46705dfff24256421A05D056c29E81Bdc09723B8"
    OMG_PROVIDER="0x23735750a6ed0119e778d9bb969137df8cc8c3d1"
    SUSHI_PROVIDER="0xE93381fB4c4F14bDa253907b18faD305D799241a"
    xSUSHI_PROVIDER="0xf977814e90da44bfa03b6295a0616a897441acec"
    COMBO_PROVIDER="0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88"
    RCOMBO_PROVIDER="0x344651A2445484bd2928eB46D2610DaaC1B42A66"
    GELATOV2_ADDRESS="0x3CACa7b48D0573D793d3b0279b5F0029180E83b6"
    MATIC_PROVIDER="0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2"
    CURVE_TRICRYPTOCRV_PROVIDER="0xB65cef03b9B89f99517643226d76e286ee999e77"
    CURVE_FACTORY_TUSD_PROVIDER="0x12C2feBc4f4b34320B4AF07CE03b926eb31944D1"
    ETH_PROVIDER_CONTRACT="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

    echo "ETH_MAINNET_NODE:" $ETH_MAINNET_NODE
    
    npx hardhat node --fork $ETH_MAINNET_NODE --no-deploy >/dev/null &
    
    echo "no deployment script will be executed"    

    hardhat_pid=$!
}

wait_hardhat_ready() {

    while [ -z "$( lsof -i:8545 )" ]
    do 
        echo "wait hardhat network launching...might take some time if doing migration script."
        sleep 3
    done
}

if hardhat_running; then
    echo "Using existing hardhat network instance"
else
    echo "Starting new hardhat network instance"
    start_hardhat
fi

wait_hardhat_ready

npx hardhat --version

# Execute rest test files with suffix `.test.js`
npx hardhat --network localhost test $tests

