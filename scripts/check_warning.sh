compile_result=`ls ./artifacts/build-info/*.json`
for eachfile in $compile_result
do
   if grep -q "\"type\": \"Warning\"" $eachfile; then
        echo "Got compile warning...please check and make it warning free. Thank you^^"
        exit 1
   fi
done
