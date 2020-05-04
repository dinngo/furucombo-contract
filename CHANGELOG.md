# Change Log

All notable changes to this project will be documented in this file.

## [unreleased]

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
