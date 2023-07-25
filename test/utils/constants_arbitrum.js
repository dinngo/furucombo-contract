const arbitrum = require('../../deploy/utils/addresses_arbitrum');

module.exports = {
  NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  NATIVE_TOKEN_DECIMAL: 18,

  /* Wrapped Native Token */
  WRAPPED_NATIVE_TOKEN: arbitrum.WRAPPED_NATIVE_TOKEN,
  AWRAPPED_NATIVE_V3_TOKEN: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
  AWRAPPED_NATIVE_V3_DEBT_VARIABLE:
    '0x0c84331e39d6658Cd6e6b9ba04736cC4c4734351',
  RWRAPPED_NATIVE_TOKEN: '0x0dF5dfd95966753f01cb80E76dc20EA958238C46',
  RWRAPPED_NATIVE_DEBT_VARIABLE: '0xab04c0841f39596C9F18A981a2BD32F63AB7a817',

  /* WETH */
  WETH_TOKEN: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  AWETH_V3_TOKEN: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
  AWETH_V3_DEBT_STABLE: '0xD8Ad37849950903571df17049516a5CD4cbE55F6',
  AWETH_V3_DEBT_VARIABLE: '0x0c84331e39d6658Cd6e6b9ba04736cC4c4734351',
  RWETH_TOKEN: '0x0dF5dfd95966753f01cb80E76dc20EA958238C46',
  RWETH_DEBT_VARIABLE: '0xab04c0841f39596C9F18A981a2BD32F63AB7a817',

  /* DAI */
  DAI_TOKEN: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  ADAI_V3_TOKEN: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE',
  ADAI_V3_DEBT_STABLE: '0xd94112B5B62d53C9402e7A60289c6810dEF1dC9B',
  ADAI_V3_DEBT_VARIABLE: '0x8619d80FB0141ba7F184CbF22fd724116D9f7ffC',
  RDAI_TOKEN: '0x0D914606f3424804FA1BbBE56CCC3416733acEC6',
  RDAI_DEBT_VARIABLE: '0x04A8fAEd05C97290Ab4d793A971AdEe97cD1cBbD',

  /* WBTC */
  WBTC_TOKEN: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',

  /* LINK */
  LINK_TOKEN: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',

  /* USDT */
  USDT_TOKEN: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',

  /* USDC */
  USDC_TOKEN: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  AUSDC_V3_TOKEN: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
  AUSDC_V3_DEBT_STABLE: '0x307ffe186F84a3bc2613D1eA417A5737D69A7007',
  AUSDC_V3_DEBT_VARIABLE: '0xFCCf3cAbbe80101232d343252614b6A3eE81C989',
  RUSDT_DEBT_VARIABLE: '0x7C2E0F792ea5B4a4Dbd7fA7f949CF39A5c0ba185',

  /* COMP */
  COMP_TOKEN: '0x354A6dA3fcde098F8389cad84b0182725c6C91dE',

  /* STG */
  STG_TOKEN: arbitrum.STARGATE_TOKEN,

  /* AAVE Interest Rate Mode */
  AAVE_RATEMODE: { NODEBT: 0, STABLE: 1, VARIABLE: 2 },

  /* Services */
  AAVEPROTOCOL_V3_PROVIDER: arbitrum.AAVEPROTOCOL_V3_PROVIDER,
  UNISWAPV3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  UNISWAPV3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  UNISWAPV3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  STARGATE_PARTNER_ID: arbitrum.STARGATE_PARTNER_ID,
  STARGATE_ROUTER: arbitrum.STARGATE_ROUTER,
  STARGATE_ROUTER_ETH: arbitrum.STARGATE_ROUTER_ETH,
  STARGATE_FACTORY: arbitrum.STARGATE_FACTORY,
  STARGATE_WIDGET_SWAP: arbitrum.STARGATE_WIDGET_SWAP,
  STARGATE_VAULT_ETH: '0x82cbecf39bee528b5476fe6d1550af59a9db6fc0',
  STARGATE_POOL_USDC: '0x892785f33CdeE22A30AEF750F285E18c18040c3e',
  STARGATE_DESTINATION_CHAIN_ID: 111, // Optimism
  STARGATE_UNSUPPORT_ETH_DEST_CHAIN_ID: 109, // Polygon
  STARGATE_STABLE_TO_DISALLOW_TOKEN_ID: 3, // DAI
  LAYERZERO_ENDPOINT: '0x3c2269811836af69497E5F486A85D7316753cf62',
  ONEINCH_APPROVE_SPENDER: '0x1111111254eeb25477b68fb85ed929f73a960582',
  RADIAN_PROVIDER: arbitrum.RADIAN_PROVIDER,

  COMPOUND_V3_COMET_USDC: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA',

  /* Event Signature */
  RecordHandlerResultSig:
    '0x90c726ff5efa7268723ee48df835144384bc0f012e89750782886764b5e54f16',

  // Handler Type
  HANDLER_TYPE: { TOKEN: 0, CUSTOM: 1, OTHERS: 2 },

  // Fee
  STORAGE_KEY_MSG_SENDER:
    '0xb2f2618cecbbb6e7468cc0f2aa43858ad8d153e0280b22285e28e853bb9d453a',
  STORAGE_KEY_CUBE_COUNTER:
    '0xf9543f11459ccccd21306c8881aaab675ff49d988c1162fd1dd9bbcdbe4446be',
  STORAGE_KEY_FEE_RATE:
    '0x142183525227cae0e4300fd0fc77d7f3b08ceb0fd9cb2a6c5488668fa0ea5ffa',
  STORAGE_KEY_FEE_COLLECTOR:
    '0x60d7a7cc0a45d852bd613e4f527aaa2e4b81fff918a69a2aab88b6458751d614',

  // Star NFT v4
  STAR_NFTV4: arbitrum.FREE_PASS,
};
