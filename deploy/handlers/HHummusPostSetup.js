const { get, registerHandler, registerCaller } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HHummus');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HHummusPostSetup'];
module.exports.dependencies = ['Registry', 'HHummus'];
