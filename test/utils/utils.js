const { BN, ether } = require('@openzeppelin/test-helpers');

const { ETH_PROVIDER } = require('./constants');

async function resetAccount(account) {
  const d = ether('100').sub(new BN(await web3.eth.getBalance(account)));
  if (d.isZero()) return;
  else if (d.isNeg())
    await web3.eth.sendTransaction({
      from: account,
      to: ETH_PROVIDER,
      value: d.neg(),
    });
  else
    await web3.eth.sendTransaction({
      from: ETH_PROVIDER,
      to: account,
      value: d,
    });
}

function profileGas(receipt) {
  receipt.logs.forEach(element => {
    if (element.event === 'DeltaGas')
      console.log(
        web3.utils.hexToAscii(element.args.tag) +
          ': ' +
          element.args.gas.toString()
      );
  });
}

module.exports = {
  resetAccount,
  profileGas,
};
