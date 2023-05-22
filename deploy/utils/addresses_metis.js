module.exports = {
  // Deployed addresses

  // External addresses
  HUMMUS_ROUTER01: '0x6B6F7437DF9cE9552ED7Fc8f529BAf48fb305534',
  AAVE_POOL_V3: '0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57',
  AAVEPROTOCOL_V3_PROVIDER: '0xB9FABd7500B2C6781c35Dd48d54f81fc2299D7AF',
  /// @dev WRAPPED_NATIVE_TOKEN use on HAaveProtocolV3 constructor
  /// but Metis native token also supports ERC20 interfaced, so all
  /// HAaveProtocolV3 ETH functions will not be used and execution will revert
  WRAPPED_NATIVE_TOKEN: '0x75cb093e4d61d2a2e65d8e0bbb01de8d89b53481',
};
module.exports.skip = async () => true;
