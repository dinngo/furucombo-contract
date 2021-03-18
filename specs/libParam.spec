rule noRevert (method f) {
	env e;
	require e.msg.value == 0;
	calldataarg arg;
	f(e, arg);
	assert !lastReverted;
}
