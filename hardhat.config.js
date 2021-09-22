require("@nomiclabs/hardhat-waffle");

// hardhat-deploy plugin is mainly for evm_snapshot functionality.
require('hardhat-deploy');

// Truffle and Web3.js plugin
require("@nomiclabs/hardhat-truffle5");



/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
  solidity: "0.6.12",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts:{
        mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
        path: "m/44'/60'/0'/0",
        initialIndex: 0
      },
      hardfork: "berlin"
    },
    localhost:{
      gasPrice: 1
    }
  },
  mocha: {
    timeout: 60000
  }
};
