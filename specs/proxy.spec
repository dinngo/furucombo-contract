using Registry as registry
using DummyERC20A as someToken

methods {
    // Shared-storage related
    getSlot(uint slot) returns (uint) envfree
    cache(bytes32) returns (bytes32) envfree
    getSender() returns (address) envfree
    getStackLength() returns (uint256) envfree

    // registry dispatches
    handlers(address) returns (bytes32) envfree => DISPATCHER(true)
    callers(address) returns (bytes32) envfree => DISPATCHER(true)
    bannedAgents(address) returns (uint256) envfree => DISPATCHER(true)
    fHalt() returns (bool) envfree => DISPATCHER(true)
    owner() returns (address) envfree => DISPATCHER(true)
    isValidCaller(address) returns (bool) => DISPATCHER(true)
    isValidHandler(address) returns (bool) => DISPATCHER(true)

    // for abstracting exec of handler
    0x12345678 => NONDET

    // ERC20
    transfer(address,uint256) => DISPATCHER(true)
    transferFrom(address,address,uint256) => DISPATCHER(true)
    approve(address,uint256) => DISPATCHER(true)
    allowance(address,address) returns (uint) envfree => DISPATCHER(true)
    balanceOf(address) returns (uint) envfree => DISPATCHER(true)
    totalSupply() returns (uint) envfree => DISPATCHER(true)
}

definition MAX_UINT256() returns uint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    ;

// if we start in a clear start state (cache, sender) then we end in a clear start state
rule startStateCleanup(method f, uint slot) {
    uint oldValue = getSlot(slot);

    arbitrary(f);

    uint newValue = getSlot(slot);

    // TODO: need to check this on all potential handlers too
    assert oldValue == 0 => newValue == 0, "Start state of $slot not cleaned up";
}

// if we start with a slot being non-zero then it should stay non-zero
// Status: currently violated on stack length overflow in execs.
rule noOverwrite(method f, uint slot) {
    require getStackLength() < MAX_UINT256(); // see stackLengthIncreaseIsBounded
    uint oldValue = getSlot(slot);

    arbitrary(f);

    uint newValue = getSlot(slot);
    // TODO: need to check this on all potential handlers too
    assert oldValue != 0 => newValue != 0, "Slot $slot became 0 during this execution";
}

// shows that the stack length increase is bounded. Selecting a reasonable bound gas-wise
rule stackLengthIncreaseIsBounded(method f) {
    uint256 stackLengthBefore = getStackLength();

    arbitrary(f);

    uint256 stackLengthAfter = getStackLength();
    assert stackLengthAfter <= stackLengthBefore + 1000000, "Found a way to increase stack length by more than 1 million"; // 1 million
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
    assert (f.selector != batchExec(address[],bytes32[],bytes[]).selector && f.selector != certorafallback_0().selector)
        => lastReverted, "method invocation did not revert despite being called without a set sender";
}

// if sender was initialized, and we have a callback, which functions fail? If they fail, it means they can't be callbacks
nonExecutableWithInitializedSender(method f) {
    require !f.isView; // only non-view functions, that may modify the state, are interesting.
    require getSender() != 0; // sender is initialized

    env e;
    calldataarg arg;
    f@withrevert(e, arg);
    assert lastReverted; // all non-view functions should revert if sender is already initialized (maybe except for fallback TODO)
}

// small havoc issue in batchExec, but getting coverage from execs() too.
rule transferredTokensMeanThatStackIsUpdated(method f) {
    uint256 balanceBefore = someToken.balanceOf(currentContract);
    uint256 stackLengthBefore = getStackLength();

    arbitrary(f);

    uint256 balanceAfter = someToken.balanceOf(currentContract);
    uint256 stackLengthAfter = getStackLength();

    assert balanceAfter > balanceBefore => stackLengthAfter == stackLengthBefore + 1, 
        "must push an entry to postprocess stack if transferring funds into proxy";
}

function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}