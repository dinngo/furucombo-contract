const solc = require('solc');

const SafeERC20 = artifacts.require('SafeERC20');
const IERC20 = artifacts.require('IERC20');
const SafeMath = artifacts.require('SafeMath');
const Address = artifacts.require('Address');
const Ownable = artifacts.require('Ownable');
const Context = artifacts.require('Context');
const IComptroller = artifacts.require('IComptroller');
const ICToken = artifacts.require('ICToken');
const ICEther = artifacts.require('ICEther');
const FCompoundActions = artifacts.require('FCompoundActions');
const StakingRewardsAdapterRegistry = artifacts.require(
  'StakingRewardsAdapterRegistry'
);

function getFCompoundActionsBytecodeBySolc() {
  const solcInput = {
    language: 'Solidity',
    sources: {
      'FCompoundActions.sol': {
        content: FCompoundActions.source,
      },
    },
    settings: {
      remappings: [':g=/dir'],
      optimizer: {
        enabled: true,
        runs: 200,
      },
      metadata: {
        // Use only literal content and not URLs (false by default)
        useLiteralContent: true,
      },
      outputSelection: {
        'FCompoundActions.sol': {
          FCompoundActions: ['*'],
        },
      },
    },
  };
  const solcOutput = JSON.parse(
    solc.compile(JSON.stringify(solcInput), { import: findImports })
  );
  const bytecodeStr =
    solcOutput.contracts['FCompoundActions.sol']['FCompoundActions'].evm
      .bytecode.object;
  const bytecode = '0x' + bytecodeStr;
  return bytecode;
}

function getAdapterRegistryBytecodeBySolc() {
  const solcInput = {
    language: 'Solidity',
    sources: {
      'StakingRewardsAdapterRegistry.sol': {
        content: StakingRewardsAdapterRegistry.source,
      },
    },
    settings: {
      remappings: [':g=/dir'],
      optimizer: {
        enabled: true,
        runs: 200,
      },
      metadata: {
        // Use only literal content and not URLs (false by default)
        useLiteralContent: true,
      },
      outputSelection: {
        'StakingRewardsAdapterRegistry.sol': {
          StakingRewardsAdapterRegistry: ['*'],
        },
      },
    },
  };
  const solcOutput = JSON.parse(
    solc.compile(JSON.stringify(solcInput), { import: findImports })
  );
  const bytecodeStr =
    solcOutput.contracts['StakingRewardsAdapterRegistry.sol'][
      'StakingRewardsAdapterRegistry'
    ].evm.bytecode.object;
  const bytecode = '0x' + bytecodeStr;
  return bytecode;
}

function findImports(path) {
  if (path === '@openzeppelin/contracts/token/ERC20/SafeERC20.sol')
    return {
      contents: SafeERC20.source,
    };
  else if (path === '@openzeppelin/contracts/token/ERC20/IERC20.sol')
    return {
      contents: IERC20.source,
    };
  else if (path === '@openzeppelin/contracts/math/SafeMath.sol')
    return {
      contents: SafeMath.source,
    };
  else if (path === '@openzeppelin/contracts/utils/Address.sol')
    return {
      contents: Address.source,
    };
  else if (path === '@openzeppelin/contracts/access/Ownable.sol')
    return {
      contents: Ownable.source,
    };
  else if (path === '@openzeppelin/contracts/GSN/Context.sol')
    return {
      contents: Context.source,
    };
  else if (path === 'IComptroller.sol')
    return {
      contents: IComptroller.source,
    };
  else if (path === 'ICToken.sol')
    return {
      contents: ICToken.source,
    };
  else if (path === 'ICEther.sol')
    return {
      contents: ICEther.source,
    };
  else return { error: 'File not found' };
}

module.exports = {
  getFCompoundActionsBytecodeBySolc,
  getAdapterRegistryBytecodeBySolc,
};
