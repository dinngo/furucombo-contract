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
    TEST_MNEMONIC_PHRASE="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
    ETHER_PROVIDER="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    DAI_PROVIDER="0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667"
    MKR_PROVIDER="0x2c4bd064b998838076fa341a83d007fc2fa50957"
    BAT_PROVIDER="0x2e642b8d59b45a1d8c5aef716a84ff44ea665914"
    USDT_PROVIDER="0x7b8c69a0f660cd43ef67948976daae77bc6a019b"
    TEST_USER="0xa3C1C91403F0026b9dd086882aDbC8Cdbc3b3cfB"

    # node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff -m "$TEST_MNEMONIC_PHRASE" > /dev/null &
    node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff --debug -f $ETH_MAINNET_NODE -m "$TEST_MNEMONIC_PHRASE" -u "$ETHER_PROVIDER" -u "$DAI_PROVIDER" -u "$MKR_PROVIDER" -u "$BAT_PROVIDER" -u "$USDT_PROVIDER" -u "$TEST_USER" > /dev/null &


    ganache_pid=$!
}

if ganache_running; then
    echo "Using existing ganache instance"
else
    echo "Starting new ganache instance"
    start_ganache
fi

truffle version

node_modules/.bin/truffle test "$@"
