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

tests="$@"
echo "running tests:"
echo "$tests"

start_hardhat() {

    echo "ETH_MAINNET_NODE:" $ETH_MAINNET_NODE
    
    npx hardhat node --fork $ETH_MAINNET_NODE --no-deploy >/dev/null &
    
    echo "no deployment script will be executed"    

    hardhat_pid=$!
}

wait_hardhat_ready() {

    while ! hardhat_running
    do 
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

