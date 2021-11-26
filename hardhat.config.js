require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');

// Truffle and Web3.js plugin
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      'contracts/handlers/maker/dapphub/DSAuth.sol': {
        version: '0.6.12',
      },
      'contracts/handlers/maker/dapphub/DSGuard.sol': {
        version: '0.6.12',
      },
      'contracts/handlers/maker/dapphub/DSGuardFactory.sol': {
        version: '0.6.12',
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: {
        mnemonic:
          'dice shove sheriff police boss indoor hospital vivid tenant method game matter',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
      },
      hardfork: 'berlin',
    },
    // Due to "evm_snapshot/evm_revert" JSON-RPC method used in tests
    // we have to launch hardhat network at localhost:8545(like ganache)
    // and use "--network localhost" parameter to connect to localhost:8545.
    // some settings like gasPrice might be overrided if we configure it at networks "hardhat".
    // So configure these parameters at networks "localhost".
    localhost: {
      gasPrice: 1,
      gas: 30000000,
      timeout: 900000,
    },
  },
  mocha: {
    timeout: 900000,
  },
};
