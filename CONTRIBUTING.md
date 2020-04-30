# Contributing to Furucombo

## Contribution guidelines

Base on the structure of Furucombo, there are several [guidelines](GUIDELINES.md) that you should follow. Please make sure to review the document.

## Creating merge requests (MRs)

Any direct modification to develop branch is prohibited. Please work on your own fork and submit merge requests. The MRs will be reviewed and commented. CI test should pass and every comment should be resolved before the MR is merged back to develop.

## A typical workflow

1. Make sure you fork is updated

```
cd legocontract
git remote add upstream git@garage.dinngo.co:hackathon-black/legocontract.git
git fetch upstream
git rebase upstream/develop
```

2. Branch out from develop

```
git checkout -b some-feature
```

3. Do your work and **Unit test**, commit and push to you fork

```
git add contracts/yourFile.sol tests/yourFile.test.js
git commit "some-feature"
git push origin some-feature
```

4. Update [change log](CHANGELOG.md). Description should be written under proper tag in the **unreleased** section.

4. Issue a new MR
