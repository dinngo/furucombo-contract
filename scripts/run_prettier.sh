#!/bin/bash
set -o errexit

./node_modules/prettier/bin-prettier.js --write "test/**/*.js"
./node_modules/prettier/bin-prettier.js --write "contracts/**/*.sol"
