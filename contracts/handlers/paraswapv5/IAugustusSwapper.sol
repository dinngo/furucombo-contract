// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAugustusSwapper {
    struct FeeStructure {
    uint256 partnerShare;
    bool noPositiveSlippage;
    bool positiveSlippageToUser;
    uint16 feePercent;
    string partnerId;
    bytes data;
  }

  function getTokenTransferProxy() external view returns (address);
}
