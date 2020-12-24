const { BN, ether } = require('@openzeppelin/test-helpers');
const fetch = require('node-fetch');
const { ETH_PROVIDER, RecordHandlerResultSig } = require('./constants');

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

async function evmSnapshot(host = 'http://localhost:8545') {
  const body = { id: 1337, jsonrpc: '2.0', method: 'evm_snapshot', params: [] };
  const response = await fetch(host, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (data != null && data.result != null) {
    // return the snapshot id
    return data.result;
  }
  // snapshot failed
  console.log(`evmSnapshot failed`);
  return -1;
}

async function evmRevert(id = 1, host = 'http://localhost:8545') {
  // ganache snapshot id must >= 1
  if (id < 1) {
    console.log(`evmRevert failed: unacceptable snapshot id`);
    return false;
  }
  const body = { id: 1337, jsonrpc: '2.0', method: 'evm_revert', params: [id] };
  const response = await fetch(host, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  let result = false;
  if (data != null && data.result != null) {
    result = data.result;
  }
  if (!result) console.log(`evmRevert failed`);
  return result;
}

async function evmRevertAndSnapshot(id = 1, host = 'http://localhost:8545') {
  // ganache snapshot id must >= 1
  if (id < 1) {
    console.log(`evmRevertAndSnapshot failed: unacceptable snapshot id`);
    return -1;
  }
  const revertSuccess = await evmRevert(id, host);
  let new_id = -1;
  if (revertSuccess) {
    new_id = await evmSnapshot(host);
  }
  if (new_id == -1) console.log(`evmRevertAndSnapshot failed`);
  return new_id;
}

function mulPercent(num, percentage) {
  return new BN(num).mul(new BN(percentage)).div(new BN(100));
}

function cUnit(amount) {
  return new BN(amount).mul(new BN('100000000'));
}

function getHandlerReturn(receipt, dataTypes) {
  var handlerResult;
  receipt.receipt.rawLogs.forEach(element => {
    if (element.topics[0] === RecordHandlerResultSig) {
      const bytesData = web3.eth.abi.decodeParameters(
        ['bytes'],
        element.data
      )[0];
      handlerResult = web3.eth.abi.decodeParameters(dataTypes, bytesData);
    }
  });
  return handlerResult;
}

module.exports = {
  profileGas,
  evmSnapshot,
  evmRevert,
  evmRevertAndSnapshot,
  mulPercent,
  cUnit,
  getHandlerReturn,
};
