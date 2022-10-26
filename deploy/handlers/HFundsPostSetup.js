const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HFunds');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HFundsPostSetup'];
module.exports.dependencies = ['Registry', 'HFunds'];
