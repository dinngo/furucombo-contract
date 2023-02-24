const fantom = require('../../deploy/utils/addresses_fantom');

module.exports = {
  NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  NATIVE_TOKEN_DECIMAL: 18,

  /* Wrapped Native Token */
  WRAPPED_NATIVE_TOKEN: fantom.WRAPPED_NATIVE_TOKEN,
  WFTM_TOKEN: fantom.WRAPPED_NATIVE_TOKEN,
  GWRAPPED_NATIVE_TOKEN: '0x39b3bd37208cbade74d0fcbdbb12d606295b430a',

  /* WBTC */
  WBTC_TOKEN: '0x321162Cd933E2Be498Cd2267a90534A804051b11',

  /* WETH */
  WETH_TOKEN: '0x74b23882a30290451A17c44f4F05243b6b58C76d',

  /* DAI */
  DAI_TOKEN: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  GDAI: '0x07e6332dd090d287d3489245038daf987955dcfb',

  /* fUSDT */
  USDT_TOKEN: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  GUSDT: '0x940F41F0ec9ba1A34CF001cc03347ac092F5F6B5',
  GUSDT_DEBT_STABLE: '0xe22367ed4eC6fD250f712D61560BB46Ce5B29a82',
  GUSDT_DEBT_VARIABLE: '0x816eD5Ee0c7b011024be3fb5b6166f59A7cbe0e4',

  /* USDC */
  USDC_TOKEN: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',

  /* ANY */
  ANY_TOKEN: '0xdDcb3fFD12750B45d32E084887fdf1aABAb34239',

  /* miMATIC */
  MIMATIC_TOKEN: '0xfB98B335551a418cD0737375a2ea0ded62Ea213b',

  /* AAVE Interest Rate Mode */
  AAVE_RATEMODE: { NODEBT: 0, STABLE: 1, VARIABLE: 2 },

  /* Services */
  GEIST_LENDING_POOL_PROVIDER: fantom.GEIST_LENDING_POOL_PROVIDER,
  SPOOKY_FACTORY: '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3',
  SPOOKY_ROUTER: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
  SUSHISWAP_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  BEETHOVENX_VAULT: '0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce',
  SPOOKY_WFTM_WETH: '0xf0702249F4D3A25cD3DED7859a165693685Ab577',
  SPOOKY_DAI_USDC: '0x484237bc35cA671302d19694c66d617142FBC235',
  SPOOKY_DAI_WETH: '0xa5960dBb334d373756C0db6323b4bfe24f392d56',
  CURVE_ADDRESS_PROVIDER: '0x0000000022D53366457F9d5E68Ec105046FC4383',
  CURVE_FUSDTCRV: '0x92D5ebF3593a92888C25C0AbEF126583d4b5312E',
  CURVE_FUSDT_SWAP: '0x92D5ebF3593a92888C25C0AbEF126583d4b5312E',
  CURVE_FUSDT_GAUGE: '0x06e3C4da96fd076b97b7ca3Ae23527314b6140dF',
  CURVE_FUSDT_DEPOSIT: '0xa42Bd395F183726d1a8774cFA795771F8ACFD777',
  CURVE_2POOLCRV: '0x27E611FD27b276ACbd5Ffd632E5eAEBEC9761E40',
  CURVE_2POOL_SWAP: '0x27E611FD27b276ACbd5Ffd632E5eAEBEC9761E40',
  CURVE_2POOL_GAUGE: '0x15bB164F9827De760174d3d3dAD6816eF50dE13c',
  CURVE_GEISTCRV: '0xD02a30d33153877BC20e5721ee53DeDEE0422B2F',
  CURVE_GEIST_SWAP: '0x0fa949783947Bf6c1b171DB13AEACBB488845B3f',
  CURVE_GEIST_GAUGE: '0xF7b9c402c4D6c2eDbA04a7a515b53D11B1E9b2cc',
  CURVE_TRICRYPTOCRV: '0x58e57cA18B7A47112b877E31929798Cd3D703b0f',
  CURVE_TRICRYPTO_SWAP: '0x3a1659Ddcf2339Be3aeA159cA010979FB49155FF',
  CURVE_TRICRYPTO_GAUGE: '0x319E268f0A4C85D404734ee7958857F5891506d7',
  CURVE_MAI3POOLCRV: '0xA58F16498c288c357e28EE899873fF2b55D7C437',
  CURVE_MAI3POOL_SWAP: '0xA58F16498c288c357e28EE899873fF2b55D7C437',
  CURVE_MAI3POOL_GAUGE: '0x95069889DF0BCdf15bc3182c1A4D6B20631F3B46',

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
  STAR_NFTV4: fantom.FREE_PASS,
};
