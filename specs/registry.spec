/**
Registration of handlers can only be modified by the relevant functions
Unregistration of handlers cannot be undone
Registration of callers can only be modified by the relevant functions
Unregistration of handlers cannot be undone
Banning is reversible
Halting is reversible

*/

methods {
    handlers(address) returns (bytes32) envfree
    callers(address) returns (bytes32) envfree
    bannedAgents(address) returns (uint256) envfree
    fHalt() returns (bool) envfree
    owner() returns (address) envfree
}

definition deprecated() returns uint = 0x6465707265636174656400000000000000000000000000000000000000000000;

function handlerTransition(address handler, bytes32 before, bytes32 after, method f) {
    require before == handlers(handler);
    callArbitrary(f);
    require after == handlers(handler);
}

function callerTransition(address caller, bytes32 before, bytes32 after, method f) {
    require before == callers(caller);
    callArbitrary(f);
    require after == callers(caller);
}

rule changesHandler(method f, address handler) {
    bytes32 _regState;
    bytes32 regState_;
    handlerTransition(handler, _regState, regState_, f);
    assert _regState == regState_, "method changes handler info";
}

rule deprecatesHandler(method f, address handler) {
    bytes32 _regState;
    bytes32 regState_;
    handlerTransition(handler, _regState, regState_, f);
    assert _regState != deprecated() /* non deprecated */ => regState_ != deprecated();
}

rule changesCaller(method f, address caller) {
    bytes32 _regState;
    bytes32 regState_;
    callerTransition(caller, _regState, regState_, f);
    assert _regState == regState_, "method changes caller info";
}

rule deprecatesCaller(method f, address caller) {
    bytes32 _regState;
    bytes32 regState_;
    callerTransition(caller, _regState, regState_, f);
    assert _regState != deprecated() /* non deprecated */ => regState_ != deprecated();
}

rule unregisterHandlerIsPermanent(method f, address handler) {
    env e;
    unregister(e, handler);

    callArbitrary(f);

    assert handlers(handler) == deprecated(), "unexpected handler info after unregister";
}

rule unregisterCallerIsPermanent(method f, address caller) {
    env e;
    unregisterCaller(e, caller);

    callArbitrary(f);

    assert callers(caller) == deprecated(), "unexpected caller info after unregister";
}

rule unregisterHandlerIsPermanent2(method f, address handler) {
    require handlers(handler) == deprecated();

    callArbitrary(f);

    assert handlers(handler) == deprecated(), "unexpected handler info after unregister";
}

rule unregisterCallerIsPermanent2(method f, address caller) {
    require callers(caller) == deprecated();

    callArbitrary(f);

    assert callers(caller) == deprecated(), "unexpected caller info after unregister";
}

rule banningIsReversible(address agent, method f) {
    env e;
    ban(e, agent);

    // call some function for covering more cases
    require f.selector != unban(address).selector;
    callArbitrary(f);

    env e2;
    require e2.msg.value == 0;
    require e2.msg.sender == e.msg.sender;
    unban@withrevert(e2, agent);
    assert !lastReverted, "Unbanning should succeed";
}

rule haltingIsReversible(method f) {
    env e;
    halt(e);

    // call some function for covering more cases
    require f.selector != unhalt().selector;
    callArbitrary(f);

    env e2;
    require e2.msg.value == 0;
    require e2.msg.sender == owner();
    assert e.msg.sender != 0, "Cannot send transactions from 0 address";
    unhalt@withrevert(e2);
    assert !lastReverted, "Unhalting should succeed";
}

function callArbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}