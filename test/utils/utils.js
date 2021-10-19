const { BN, ether } = require('@openzeppelin/test-helpers');
const fetch = require('node-fetch');
const { ETH_PROVIDER, RecordHandlerResultSig } = require('./constants');

const { expect } = require('chai');

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

function errorCompare(a, b, e = new BN('1')) {
  expect(a.sub(b).abs()).to.be.bignumber.lte(e);
}

// Only works when one function name matches
function getAbi(artifact, name) {
  var abi;
  artifact.abi.forEach((element, i) => {
    if (element.name === name) {
      abi = element;
    }
  });
  return abi;
}

function getCallData(artifact, name, params) {
  return web3.eth.abi.encodeFunctionCall(getAbi(artifact, name), params);
}

function decodeInputData(artifact, name, params) {
  return web3.eth.abi.decodeParameters(getAbi(artifact, name).inputs, params);
}

function decodeOutputData(artifact, name, params) {
  return web3.eth.abi.decodeParameters(getAbi(artifact, name).outputs, params);
}

function getFuncSig(artifact, name) {
  return web3.eth.abi.encodeFunctionSignature(getAbi(artifact, name));
}

function expectEqWithinBps(actual, expected, bps = 1) {
  const base = new BN('10000');
  const upper = new BN(expected).mul(base.add(new BN(bps))).div(base);
  const lower = new BN(expected).mul(base.sub(new BN(bps))).div(base);
  expect(actual).to.be.bignumber.lte(upper);
  expect(actual).to.be.bignumber.gte(lower);
}

module.exports = {
  profileGas,
  evmSnapshot,
  evmRevert,
  evmRevertAndSnapshot,
  mulPercent,
  cUnit,
  getHandlerReturn,
  errorCompare,
  getAbi,
  getCallData,
  decodeInputData,
  decodeOutputData,
  getFuncSig,
  expectEqWithinBps,
};
