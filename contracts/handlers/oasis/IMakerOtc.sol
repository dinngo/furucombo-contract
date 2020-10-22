pragma solidity ^0.6.0;

interface IMakerOtc {
    function sellAllAmount(address pay_gem, uint pay_amt, address buy_gem, uint min_fill_amount) external returns (uint fill_amt);
    function buyAllAmount(address buy_gem, uint buy_amt, address pay_gem, uint max_fill_amount) external returns (uint fill_amt);
    function getPayAmount(address pay_gem, address buy_gem, uint buy_amt) external view returns (uint fill_amt);
    function getBuyAmount(address buy_gem, address pay_gem, uint pay_amt) external view returns (uint fill_amt);
}
