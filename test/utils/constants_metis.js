const metis = require('../../deploy/utils/addresses_metis');

module.exports = {
  NATIVE_TOKEN_ADDRESS: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
  NATIVE_TOKEN_DECIMAL: 18,

  /* Wrapped Native Token */
  WRAPPED_NATIVE_TOKEN: metis.WRAPPED_NATIVE_TOKEN,
  AWRAPPED_NATIVE_V3_TOKEN: '0x7314Ef2CA509490f65F52CC8FC9E0675C66390b8',

  /* WETH */
  WETH_TOKEN: '0x420000000000000000000000000000000000000A',

  /* DAI */
  DAI_TOKEN: '0x4c078361fc9bbb78df910800a991c7c3dd2f6ce0',
  DAI_TOKEN_PROVIDER: '0x9A8cF02F3e56c664Ce75E395D0E4F3dC3DafE138',
  ADAI_V3_TOKEN: '0x85ABAdDcae06efee2CB5F75f33b6471759eFDE24',
  ADAI_V3_DEBT_VARIABLE: '0x13Bd89aF338f3c7eAE9a75852fC2F1ca28B4DDbF',

  /* USDC */
  USDC_TOKEN: '0xEA32A96608495e54156Ae48931A7c20f0dcc1a21',
  AUSDC_V3_DEBT_VARIABLE: '0x571171a7EF1e3c8c83d47EF1a50E225E9c351380',

  /* AAVE Interest Rate Mode */
  AAVE_RATEMODE: { NODEBT: 0, STABLE: 1, VARIABLE: 2 },

  /* Services */
  AAVEPROTOCOL_V3_PROVIDER: metis.AAVEPROTOCOL_V3_PROVIDER,

  /* Event Signature */
  RecordHandlerResultSig:
    '0x90c726ff5efa7268723ee48df835144384bc0f012e89750782886764b5e54f16',

  // Handler Type
  HANDLER_TYPE: { TOKEN: 0, CUSTOM: 1, OTHERS: 2 },
};
