pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IFeeRuleRegistry.sol";
import "./interface/IRule.sol";

contract FeeRuleRegistry is IFeeRuleRegistry, Ownable {
    using SafeMath for uint256;

    mapping(uint256 => address) public override rules;

    uint256 public override counter;
    uint256 public override basisFeeRate;
    address public override feeCollector;
    uint256 public constant override BASE = 1e18;

    event RegisteredRule(uint256 index, address rule);
    event UnregisteredRule(uint256 index);
    event SetBasisFeeRate(uint256 basisFeeRate);
    event SetFeeCollector(address feeCollector);

    constructor(uint256 basisFeeRate_, address feeCollector_) public {
        if (basisFeeRate_ != 0) setBasisFeeRate(basisFeeRate_);
        setFeeCollector(feeCollector_);
    }

    function setBasisFeeRate(uint256 basisFeeRate_) public override onlyOwner {
        require(basisFeeRate_ <= BASE, "Out of range");
        require(basisFeeRate_ != basisFeeRate, "Same as current one");
        basisFeeRate = basisFeeRate_;
        emit SetBasisFeeRate(basisFeeRate);
    }

    function setFeeCollector(address feeCollector_) public override onlyOwner {
        require(feeCollector_ != address(0), "Zero address");
        require(feeCollector_ != feeCollector, "Same as current one");
        feeCollector = feeCollector_;
        emit SetFeeCollector(feeCollector);
    }

    function registerRule(address rule_) external override onlyOwner {
        require(rule_ != address(0), "Not allow to register zero address");
        rules[counter] = rule_;
        emit RegisteredRule(counter, rule_);
        counter = counter.add(1);
    }

    function unregisterRule(uint256 ruleIndex) external override onlyOwner {
        require(rules[ruleIndex] != address(0), "Rule not set or unregistered");
        rules[ruleIndex] = address(0);
        emit UnregisteredRule(ruleIndex);
    }

    function calFeeRateMulti(address usr_, uint256[] calldata ruleIndexes)
        external
        view
        override
        returns (uint256 scaledRate)
    {
        scaledRate = calFeeRateMultiWithoutBasis(usr_, ruleIndexes)
            .mul(basisFeeRate)
            .div(BASE);
    }

    function calFeeRateMultiWithoutBasis(
        address usr_,
        uint256[] calldata ruleIndexes
    ) public view override returns (uint256 scaledRate) {
        uint256 len = ruleIndexes.length;
        if (len == 0) {
            scaledRate = BASE;
        } else {
            scaledRate = _calDiscount(usr_, rules[ruleIndexes[0]]);
            for (uint256 i = 1; i < len; i++) {
                require(
                    ruleIndexes[i] > ruleIndexes[i - 1],
                    "Not ascending order"
                );

                scaledRate = scaledRate
                    .mul(_calDiscount(usr_, rules[ruleIndexes[i]]))
                    .div(BASE);
            }
        }
    }

    function calFeeRate(address usr_, uint256 ruleIndex)
        external
        view
        override
        returns (uint256 scaledRate)
    {
        scaledRate = calFeeRateWithoutBasis(usr_, ruleIndex)
            .mul(basisFeeRate)
            .div(BASE);
    }

    function calFeeRateWithoutBasis(address usr_, uint256 ruleIndex)
        public
        view
        override
        returns (uint256 scaledRate)
    {
        scaledRate = _calDiscount(usr_, rules[ruleIndex]);
    }

    /* Internal Functions */
    function _calDiscount(address usr_, address rule_)
        internal
        view
        returns (uint256 discount)
    {
        if (rule_ != address(0)) {
            discount = IRule(rule_).calDiscount(usr_);
            require(discount <= BASE, "Discount out of range");
        } else {
            discount = BASE;
        }
    }
}
