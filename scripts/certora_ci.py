#!/bin/python3

import os
import time
import subprocess
import argparse


RULE_DIR = './specs/scripts'
CONTRACT_RULES_MAP = {
    # Proxy, Registry and libPrams
    "LibParam.sol": ["libParam.sh", "naiveLibParam.sh", "naiveLibParamB63.sh"],
    "Registry.sol": ["privRegistry.sh", "registry.sh"],
    "Proxy.sol": ["privProxy.sh", "proxy.sh proxy"],

    # Handler
    "HAaveProtocol.sol": ["runHAave.sh"],
    "HAaveProtocolV2.sol": ["runHAave2.sh"],
    "HBalancer.sol": ["runHBalancer.sh", "runHBalancerSpecific.sh"],
    "HBProtocol.sol": ["runHBProtocol.sh", "runHBProtocolSpecific.sh"],
    "HCEther.sol": ["runHCEther.sh"],
    "HCToken.sol": ["runHCToken.sh"],
    "HComptroller.sol": ["runHComptroller.sh"],
    "HSCompound.sol": ["runHSCompound.sh", "runHSCompoundSpecific.sh"],
    "HCurve.sol": ["runHCurve.sh"],
    "HCurveDao.sol": ["runHCurveDao.sh"],
    "HFunds.sol": ["runHFunds.sh"],
    "HFurucomboStaking.sol": ["runHFurucomboStaking.sh"],
    "HGasTokens.sol": ["runHGasTokens.sh"],
    "HMaker.sol": ["runHMaker.sh", "runHMakerSpecific.sh"],
    "HStakingRewardsAdapter.sol": ["runHStakingRewardsAdapter.sh"],
    "HSushiSwap.sol": ["runHSushiSwap.sh"],
    "HUniswapV2.sol": ["runHUniswapV2.sh"],
    "HYVault.sol": ["runHYVault.sh"],
    "HWeth.sol": ["runHWeth.sh"],
    "HUniswapV3.sol": ["runHUniswapV3.sh"],
    "HPolygon.sol": ["runHPolygon.sh"],
    "HOneInchV3.sol": ["runHOneInchV3.sh"],
    "HGelatoV2LimitOrder.sol": ["runHGelatoV2LimitOrder.sh"]
}


def run_cmd(cmd):
    process = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
    status = process.wait()
    out, err = process.communicate()
    if status > 0:
        raise Exception("execute cmd(%s): %r" % (cmd, err))
    return out


def get_changed_contracts():
    out = run_cmd("git log -m -1 --name-only --pretty=\"format: \"")
    files = str(out, 'utf-8').split('\n')
    sols = []
    for f in files:
        if str.endswith(f, '.sol') and str.startswith(f, 'contracts'):
            sols.append(f.split('/')[-1])
    print("changed contract: \n %r" % sols)
    return sols


def _exec_certora_rule(rule):
    _cmd = "%s/%s" % (RULE_DIR, rule)
    print(_cmd)
    report = {
        "job_id": "Not found, please review certora prover home",
        "job_status": '',
        "job_output": ''
    }

    process = subprocess.Popen(
        [_cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)

    _prefix = 'You can follow up on the status: '
    while True:
        output = process.stdout.readline().decode('utf-8')
        if _prefix in output:
            output = output.replace(_prefix, '')
            report["job_id"] = output.split('?')[0].split('/')[-1]
            report["job_status"] = output
            report["job_output"] = output.replace("jobStatus", "output")
            break
        if 'Fatal error' in output:
            report["job_id"] = output
            break
        if process.poll() is not None:
            report["job_id"] = "Not found url"
            break
    process.terminate()
    return report


def run_certora_rules(sols):
    reports = dict()
    for sol in sols:
        if sol not in CONTRACT_RULES_MAP.keys():
            print("Can't find %s rules" % sol)
            continue
        reports[sol] = dict()
        rules = CONTRACT_RULES_MAP.get(sol, [])
        for rule in rules:
            report = _exec_certora_rule(rule)
            reports[sol][rule] = report
    return reports


def output_reports(reports):
    print("--- Report Output ---")
    for sol, rule in reports.items():
        for rule_name, rule_report in rule.items():
            print("%s(%s) job_id:%s" %
                  (sol, rule_name, rule_report['job_id']))
            print(rule_report['job_status'].replace('\n', ''))
            print(rule_report['job_output'].replace('\n', ''))
        print('-------\n')


if __name__ == "__main__":
    # parse command
    parser = argparse.ArgumentParser(
        description='Process certora prover rules.')
    parser.add_argument('--range', "-r", type=str, nargs='?',
                        default='diff', choices=['diff', 'all'])
    args = parser.parse_args()
    print(args)

    # execute certora rule
    if args.range == 'diff':
        sols = get_changed_contracts()
    else:
        sols = CONTRACT_RULES_MAP.keys()
    print("checked contract: \n %r" % sols)

    # Run certora rules
    reports = run_certora_rules(sols)
    output_reports(reports)
