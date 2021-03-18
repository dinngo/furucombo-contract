import "../../contracts/lib/LibParam.sol";

contract LibParamHarness {
	using LibParam for bytes32;

	function isStatic(bytes32 x) external returns (bool) { return x.isStatic(); }
	function isReferenced(bytes32 x) external returns (bool) { return x.isReferenced(); }
	function getReturnNum(bytes32 x) external returns (uint256) { return x.getReturnNum(); }
	function getParams(bytes32 x) external { x.getParams(); }
}
