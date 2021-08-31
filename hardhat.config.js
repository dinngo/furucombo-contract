require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
// hardhat-deploy plugin is mainly for evm_snapshot functionality.
require('hardhat-deploy');


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
  solidity: "0.6.12",
  networks: {
    hardhat: {
      accounts:{
        mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
        path: "m/44'/60'/0'/0",
        initialIndex: 0
      }
    },
  },
};
