#!/bin/bash

compile_result=`ls ./artifacts/build-info/*.json`
for eachfile in $compile_result
do
   if grep -q "\"type\": \"Warning\"" $eachfile; then
        echo "Compile Warning. Please check and make it warning free."
        exit 1
   fi
done
