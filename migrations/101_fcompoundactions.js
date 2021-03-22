const { constants } = require('@openzeppelin/test-helpers');
const {
  CREATE2_FACTORY,
  FCOMPOUND_ACTIONS_SALT,
  FCOMPOUND_ACTIONS,
} = require('../test/utils/constants');
const {
  getFCompoundActionsBytecodeBySolc,
} = require('../test/utils/getBytecode');
const ISingletonFactory = artifacts.require('ISingletonFactory');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  const singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);
  // Check if deployed contract address is same to the predicted one
  const deployAddr = await singletonFactory.deploy.call(
    getFCompoundActionsBytecodeBySolc(),
    FCOMPOUND_ACTIONS_SALT
  );

  // Exit if we get zero address
  if (deployAddr == constants.ZERO_ADDRESS) {
    console.log(`Got zero address when attempting to deploy FCompoundActions`);
    return false;
  }

  if (deployAddr != FCOMPOUND_ACTIONS) {
    console.error(
      `!!!!! Got different FCompoundActions address with predicted one !!!!!`
    );
    console.error(`!!!!! Predicted: ${FCOMPOUND_ACTIONS} !!!!!`);
    console.error(`!!!!! Going To Deploy At: ${deployAddr} !!!!!`);
    console.error(`!!!!! Deploy process rejected !!!!!`);
    return false;
  }
  // Deploy FCompoundActions
  await singletonFactory.deploy(
    getFCompoundActionsBytecodeBySolc(),
    FCOMPOUND_ACTIONS_SALT
  );
  console.log(`Deployed FCompoundActions: ${deployAddr}`);
};
