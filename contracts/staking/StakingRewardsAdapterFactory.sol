pragma solidity ^0.5.16;

import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./StakingRewardsAdapter.sol";


contract StakingRewardsAdapterFactory is Ownable {
    // List of adapters
    mapping(address => address[]) public adapters;

    event NewAdapter(address stakingContract, address adapter);

    function newAdapter(address _stakingContract)
        external
        onlyOwner
        returns (address)
    {
        // Deploy new adapter
        StakingRewardsAdapter adapter = new StakingRewardsAdapter(
            _stakingContract
        );
        // Transfer pausership to factory owner and renounce
        adapter.addPauser(owner());
        adapter.renouncePauser();
        // Add to the list
        adapters[_stakingContract].push(address(adapter));

        emit NewAdapter(_stakingContract, address(adapter));
        return address(adapter);
    }
}
