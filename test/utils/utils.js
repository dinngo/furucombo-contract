const { BN, ether } = require('@openzeppelin/test-helpers');
const fetch = require('node-fetch');
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

async function evm_snapshot(host = 'http://localhost:8545') {
  const body = {"id":1337,"jsonrpc":"2.0","method":"evm_snapshot","params":[]};
  const response = await fetch(host, {
    method: 'post',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  // return the snapshot id
  return data.result;
}

async function evm_revert(id = 1, host = 'http://localhost:8545') {
  const body = {"id":1337,"jsonrpc":"2.0","method":"evm_revert","params":[id]};
  await fetch(host, {
    method: 'post',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function evm_revert_and_snapshot(id = 1, host = 'http://localhost:8545') {
  console.log(`>>>>>>>>>> revert id = ${id}`);
  await evm_revert(id, host);
  const new_id = await evm_snapshot(host);
  console.log(`>>>>>>>>>> new id = ${new_id}`);
  return new_id;
}

module.exports = {
  resetAccount,
  profileGas,
  evm_snapshot,
  evm_revert,
  evm_revert_and_snapshot,
};
