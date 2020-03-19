const { BN, ether } = require('@openzeppelin/test-helpers');

const { ETH_PROVIDER } = require('./constants');

async function resetAccount(account) {
    const d = ether('100').sub(new BN(await web3.eth.getBalance(account)));
    if (d.isZero())
        return;
    else if (d.isNeg())
        await web3.eth.sendTransaction({ from: account, to: ETH_PROVIDER, value: d.neg() });
    else
        await web3.eth.sendTransaction({ from: ETH_PROVIDER, to: account, value: d });
}

module.exports = {
    resetAccount,
};
