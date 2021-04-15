certoraRun contracts/Proxy.sol \
	--verify Proxy:specs/privileged.spec \
	--settings -t=300,-ignoreViewFunctions \
	--msg "Proxy Privileged"
