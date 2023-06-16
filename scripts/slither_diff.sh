#!/bin/bash

# Select solc version
solc_version="0.8.10"
solc-select install ${solc_version}
solc-select use ${solc_version}

# Analysis current branch
slither contracts --solc-remaps @openzeppelin/=$(pwd)/node_modules/@openzeppelin/ 2> source

# Checkout develop
git fetch origin develop
git checkout develop

# Analysis develop branch
slither contracts --solc-remaps @openzeppelin/=$(pwd)/node_modules/@openzeppelin/ 2> target

# Diff
echo --------------- diff ---------------
diff -w source target

# Return success to continue pipeline
exit 0
