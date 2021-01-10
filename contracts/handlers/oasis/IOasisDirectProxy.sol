pragma solidity ^0.6.0;

interface IOasisDirectProxy {
    function sellAllAmount(address otc, address payToken, uint payAmt, address buyToken, uint minBuyAmt) external returns (uint buyAmt);
    function sellAllAmountPayEth(address otc, address wethToken, address buyToken, uint minBuyAmt) external payable returns (uint buyAmt);
    function sellAllAmountBuyEth(address otc, address payToken, uint payAmt, address wethToken, uint minBuyAmt) external returns (uint wethAmt);
    function buyAllAmount(address otc, address buyToken, uint buyAmt, address payToken, uint maxPayAmt) external returns (uint payAmt);
    function buyAllAmountPayEth(address otc, address buyToken, uint buyAmt, address wethToken) external payable returns (uint wethAmt);
    function buyAllAmountBuyEth(address otc, address wethToken, uint wethAmt, address payToken, uint maxPayAmt) external returns (uint payAmt);
}
