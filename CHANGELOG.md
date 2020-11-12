# Change Log

All notable changes to this project will be documented in this file.

## [unreleased]

- Support Compound borrow, repayBorrow and claimComp with DSProxy in `HSCompound` and `FCompoundActions`.

## [0.12.1] - 2020-10-28

### Changed

- Refine Curve handler supporting hbtc, 3pool and meta pools.

## [0.12.0] - 2020-10-19

### Added

- Support CHI and GST2 gas tokens in `HGasTokens`.
- Support Balancer multihop swapping in `HBalancerExchange`.

## [0.11.0] - 2020-09-21

### Added

- Support Yearn vault depositETH and withdrawETH in `HYVault`.

### Changed

- Apply slippage to swapping and add/remove liquidity related testcases.
- Apply evm state reset to every testcase.
- Upgrade `prettier-plugin-solidity` to `1.0.0-alpha.57`

## [0.10.0] - 2020-09-04

### Added

- Support Yearn vault deposit and withdraw in `HYVault`.
- Support Mooniswap deposit/withdraw liquidity function in `HMooniswap`.

### Removed

- Unused `HERC20TokenIn`.

## [0.9.0] - 2020-08-21

### Added

- Support Curve add liquidity in `HCurve`.
- Support Curve remove liquidity one coin in `HCurve`.
- Support WETH deposit and withdraw function in `HWeth`.
- Support Curve deposit to gauges in `HCurveDao`.
- Support Curve mint and mint_many CRV in `HCurveDao`.

## [0.8.0] - 2020-08-10

### Added

- Add token and ether sending function in `HFunds`.
- Support Balancer add liquidity single assert/all asserts function in `HBalancer`.
- Support Balancer remove liquidity single assert/all asserts function in `HBalancer`.
- Support Compound repay function in `HCEther` and `HCToken`.
- Support OneInch fixed input eth to token swap.
- Support OneInch fixed input token to eth swap.
- Support OneInch fixed input token to token swap.

### Changed

- Wrap `HERC20TokenIn` to `HFunds`.

### Deprecated

- Unused `HERC20TokenIn`.

## [0.7.0] - 2020-07-27

### Added

- Support Curve swap through curve pools in `HCurve`.
- Support Curve swap through OneSplit aggregator in `HCurve`.

## [0.6.0] - 2020-07-13

### Added

- Support UniswapV2 fixed input/output eth to token swap.
- Support UniswapV2 fixed input/output token to eth swap.
- Support UniswapV2 fixed input/output token to token swap.
- Apply solhint.

## [0.5.0] - 2020-06-23

### Added

- Support UniswapV2 add eth/token liquidity .
- Support UniswapV2 remove eth/token liquidity.
- Support Compound claim COMP token.

## [0.4.1] - 2020-06-16

### Fixed

- Fixed error handling on custom handler followed by noop.

### Deprecated

- Unintuitive post-process handling in `_setPostProcess()`.

## [0.4.0] 2020-06-12

### Added

- Add cache handling mechanism.
- Support customized handler post processor.
- Support Maker create CDP.
- Support Maker deposit.
- Support Maker withdraw.
- Support Maker generate.
- Support Maker pay back.
- Support Oasis fixed input/output eth to token swap.
- Support Oasis fixed input/output token to eth swap.
- Support Oasis fixed input/output token to token swap.

### Changed

- Change `address[] tokens` to `bytes32[] cache`.

### Fixed

- Fix USDT transfer failure.

## [0.3.0] - 2020-05-25

### Added

- Support Aave deposit and redeem.

## [0.2.1] - 2020-05-04

### Added

- Support Compound CEther and CToken redeem and redeemUnderlying.
- Gas profiling.
- Apply prettier for solidity and js files.

### Fixed

- Revert CEther redeem and redeemUnderlying on failure.
- Revert CToken mint, redeem and redeemUnderlying on failure.

## [0.2.0] - 2020-04-20

### Added

- Support Uniswap token to token swapping.
- Change proxy structure to support a callback from flashloan service.
- Prevent user direct transfer to proxy contract.

### Changed

- Combine the uniswap handlers into a single contract.

### Fixed

- Change Kyber proxy address to constant.

## [0.1.1] - 2020-04-09

### Added

- Support KyberNetwork ether to token.
- Support KyberNetwork token to ether.
- Support KyberNetwork token to token.
- Support Uniswap fix output swapping.

## [0.1.0] - 2020-03-27

### Added

- Proxy interface for Furucombo.
- Registry for handler verification.
- Support Uniswap ether to token swapping (fix input).
- Support Uniswap add liquidity.
- Support Compound CEther and CToken mint.
- Support Uniswap token to ether swapping (fix input).
- Support erc20 token inject.
- Support Uniswap remove liquidity.
