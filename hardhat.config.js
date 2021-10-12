require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy');
require("hardhat-deploy-ethers");

// Truffle and Web3.js plugin
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-truffle5");



/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
      },
      {
        version: "0.8.6",
      },
    ],
    overrides: {
      "contracts/handlers/maker/dapphub/DSAuth.sol": {
        version: "0.6.12",
      },
      "contracts/handlers/maker/dapphub/DSGuard.sol": {
        version: "0.6.12",
      },
      "contracts/handlers/maker/dapphub/DSGuardFactory.sol": {
        version: "0.6.12",
      }
    }
  },
  namedAccounts: {
    deployer: 10
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // forking: {
      //   url: "https://eth-mainnet.alchemyapi.io/v2/SzfScxGFsSCR1qCdzGn2qvEzdWkGtIAO",
      //   blockNumber: 12354000
      // },
      accounts:{
        mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
        path: "m/44'/60'/0'/0",
        initialIndex: 0
      },
      hardfork: "berlin"
      
    },
    // migration: {
    //   // url: `${ETH_MAINNET_NODE}`,
    //   url: 'https://mainnet.infura.io/v3/e876de601519478790cf4e8c425d0aee',
    //   accounts:{
    //     mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
    //     path: "m/44'/60'/0'/0",
    //     initialIndex: 0
    //   },
    //   gas: 10000000,
    //   gasPrice: 1000000000,
    //   timeout: 600000
    // },
    localhost:{
      gasPrice: 1,
      gas: 30000000,
      timeout: 900000
    }
  },
  mocha: {
    timeout: 900000
  }
};
