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

start_hardhat() {
    
    npx hardhat node --fork $ETH_MAINNET_NODE &
    echo "deployment script will be executed" 

    hardhat_pid=$!
}

wait_hardhat_ready() {

    while [ -z "$( lsof -i:8545 )" ]
    do 
        sleep 3
    done
}


echo "Starting new hardhat network instance"
start_hardhat  


wait_hardhat_ready

npx hardhat --version


