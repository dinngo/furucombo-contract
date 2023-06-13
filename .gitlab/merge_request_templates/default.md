## What does this MR do and why?

_Describe in detail what your merge request does and why._

<!--
Please keep this description updated. Any discussion that related to this merge request
are useful for reviewers better understand your changes. Keeping the description updated is
especially important if they didn't participate in the discussion.
-->

## MR acceptance checklist

These checklists encourage us to confirm any changes have been analyzed to reduce risks in quality, security, and maintainability.

### Quality

- [ ] Implementation follows the [guidelines](GUIDELINES.md) of the project.
- [ ] Coding style follows the [Coding Style](https://app.asana.com/0/1110393615095724/1202201092359525/f).
- [ ] Unused code are removed.
- [ ] Functions are written with comments.

### Security

- [ ] Unit tests(include all reverted cases) are provided and passed.
- [ ] Code coverage report is provided.
- [ ] Static analysis report is reviewed.

### Design convention

Using below design convention if needed.

Handler:

- [ ] Handler should inherit HandlerBase.
- [ ] Use `_getBalance(address,uint256)` to handle chained input scenario or uint256.max as input amount.
- [ ] Use `_getSender()` instead of `msg.sender`.
- [ ] Use `_updateToken(address)` if the token is new to Proxy and has to be returned to the user.
- [ ] Use `_tokenApprove(address,address,uint256)` instead of token approve function.
- [ ] Use `_tokenApproveZero(address,address)` to reset token approval.
- [ ] Use `_isNotNativeToken(address)` to check if a token is native token or not.
- [ ] Use `_revertMsg(string,string)` instead of `revert("...")`.
- [ ] Use `_requireMsg(bool,string,string)` instead of `require(bool, "...")`.
- [ ] Use `amount` from function parameters instead of using msg.value.
- [ ] Use `payable` for external functions.
- [ ] Use `NATIVE_TOKEN_ADDRESS` instead of 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE.

Rule:

- [ ] Rule should inherit RuleBase.

### Documentation

- [ ] Changes are noted in the change log.
- [ ] Add the new document if needed(optional).

### Deployment

- [ ] Deployment file is provided.
- [ ] Post-setup file is provided.
