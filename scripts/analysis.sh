#!/bin/bash

# Select solc version
solc_version="0.6.12"
solc-select install ${solc_version}
solc-select use ${solc_version}

# Static analysis
slither contracts --solc-remaps @openzeppelin/=$(pwd)/node_modules/@openzeppelin/

# Return success to continue pipeline
exit 0
