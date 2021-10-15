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
      },
      {
        version: '0.8.6',
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
        accountsBalance: '10000000000000000000000', // 10000 ETH
      },
      hardfork: 'berlin',
    },
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
