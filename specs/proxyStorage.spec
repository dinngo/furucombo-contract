using Registry as registry

methods {
    getSlot(uint slot) returns (uint) envfree
    cache(bytes32) returns (bytes32) envfree
    getSender() returns (address) envfree

    // registry dispatches
    handlers(address) returns (bytes32) envfree => DISPATCHER(true)
    callers(address) returns (bytes32) envfree => DISPATCHER(true)
    bannedAgents(address) returns (uint256) envfree => DISPATCHER(true)
    fHalt() returns (bool) envfree => DISPATCHER(true)
    owner() returns (address) envfree => DISPATCHER(true)
    isValidCaller(address) returns (bool) => DISPATCHER(true)
    isValidHandler(address) returns (bool) => DISPATCHER(true)

    0x12345678 => NONDET
}

// if we start in a clear start state (cache, sender) then we end in a clear start state
rule startStateCleanup(method f, uint slot) {
    uint oldValue = getSlot(slot);

    arbitrary(f);

    uint newValue = getSlot(slot);

    // TODO: need to check this on all potential handlers too
    assert oldValue == 0 => newValue == 0;
}

// if we start with a slot being non-zero then it should stay non-zero
rule noOverwrite(method f, uint slot) {
    uint oldValue = getSlot(slot);

    arbitrary(f);

    uint newValue = getSlot(slot);
    // TODO: need to check this on all potential handlers too
    assert oldValue != 0 => newValue != 0;
}

rule cacheIsAlwaysCleanedUp(bytes32 key, method f) {
    bytes32 before = cache(key);

    arbitrary(f);

    bytes32 after = cache(key);

    assert before == 0 => after == 0;


}

rule nonExecutableByBannedAgents(method f) {
    require !f.isView; // only non-view functions, that may modify the state, are interesting.
    env e;
    require registry.bannedAgents(e.msg.sender) == 1; // sender is banned

    calldataarg arg;
    f@withrevert(e, arg);
    assert lastReverted, "method invocation did not revert despite being called by a banned agent";
}

rule nonExecutableWhenHalted(method f) {
    require !f.isView; // only non-view functions, that may modify the state, are interesting.
    require registry.fHalt(); // system is halted

    env e;
    calldataarg arg;
    f@withrevert(e, arg);
    assert lastReverted, "method invocation did not revert despite being called in a halted state";
}

rule nonExecutableWithUninitializedSender(method f) {
    require !f.isView; // only non-view functions, that may modify the state, are interesting.
    require getSender() == 0; // no sender initialized;

    env e;
    calldataarg arg;
    f@withrevert(e, arg);
    assert lastReverted, "method invocation did not revert despite being called without a set sender";
}

function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}

/*
rule transferredTokensMeanThatStackIsUpdated {
    
}
*/