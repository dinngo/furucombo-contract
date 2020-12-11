# Dynamic Cube Input Guideline

The details about dynamic cube input of Furucombo that includes config setup and common use cases. Please make sure to review the document.

## Structure
* Proxy
    * Storage
        * bytes32[] public stack;
        * mapping(bytes32 => bytes32) public cache;
    * Memory
        * bytes32[] memory localStack;
            * Store return data stack.
* Config
    * bytes32
---

## Config

config is bytes32 data represent by hex.

![](images/config.png)


- ### Param config
    -  ![](images/param_config.png)
    - `255-248` bits reserved for Param config.
    - `248`: 1 if the parameter is dynamic, 0 if the parameter is static.
    - Example:
        - `0x00` => `(b00)`: static parameter.
        - `0x01` => `(b01)`: dynamic parameter.


- ### Return data count
    - `247-240` bits reserved for return data count.
    - Expected return data count after cube executing.
    - `0` if the return data will not be referenced.
    - Example:
        - `0x04`:  the return data of the cube will be referenced and the return data count is 4.
        - `0x00`:  the return data of the cube will `not` be referenced.

- ### Parameter location
    - ![](images/parameter_config.png)
    - `239-176` bits reserved for Parameter location.
    - Every bit locate the `32` bytes (exclude 4-byte function signature) of parameter data.
    - 1 if the parameter data will be replaced by return data, 0 if not.
    - Example:
        - `0x01` => `(b001)` => replace the 1st byte32 of parameter data with return data.
        - `0x03` => `(b011)` => replace the 1st byte32 and 2nd byte32 of parameters data with return data.
        - `0x04` => `(b100)` => replace the 3th byte32 of parameter data with return data.

- ### Reference location
    - ![](images/reference_config.png)
    -  `175-0` bits reserved for Reference location.
    - Every `byte` give the location of localStack which contains the return values
    - Should be `ff` if the location is not used
    - Parameter data replacement order is from right to left except `ff`.

---

## Common Cases

- Static config
  - `0x0000000000000000000000000000000000000000000000000000000000000000`
- Referenced with return data count is 1, static parameter config
  - `0x0001000000000000000000000000000000000000000000000000000000000000`
- Not referenced, dynamic on second byte32, referencing localStack[0]
  - `0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff`

---

## Return Data Type
Return data fall into two broad categories: `Value` and `Reference`.

### Value Type

Value type return data will store in localStack in order (non-array).
Ex.
  - `uint256`
  - `bytes32`
  - `bool`
  - ...


![](images/value_type.png)

### Reference Type

Reference type (dynamic array) includes `2` extra data(`pointer` and ` length`) except `data`. Every reference type return data count is `+2`, `+1` increased by every data. . `pointer` store in the original position, `length` and `data` will store the location that `pointer` pointer in order.
Ex.
  - `uint256[]`
  - `address[]`
  - `uint8[]`
  - ..

**Example**

`returns(uint256 a, uint8[] memory b, bytes32 c)`
```
a           = 1
b.length    = 3
b[0]        = 2
b[1]        = 3
b[2]        = 4
c           = 0x0000000.....0F
```
return data will be:

```
returnData.length = 1 + (2 + 3) + 1 = 7
returnData[0] = 1
returnData[1] = pointer (returnData[3] address)
returnData[2] = 0x0000000.....0F
returnData[3] = length (useless)
returnData[4] = 2
returnData[5] = 3
returnData[6] = 4
```
![](images/dynamic_array.png)
## Percentage of dynamic parameter
`dynamic parameter = return data * percentage, 0 < percentage <= 1`

![](images/percentage.png)


Replace the original parameter with **fraction** if using a dynamic parameter. The fraction will be divided by `ether(1)` for getting the **percentage** of return data.
* fraction
    * `uint256` type
    * denominator is `ether(1)`
    * `0 <= fraction <= ether(1)`
    * `0` if replace parameter with 100% of return data.



**Example**
* Replace second parameter with 50% of return data.
    * `function bar(a, ether(0.5), c)`
* Replace first parameter with 70% of return data.
    * `function bar(ether(0.7), b, c)`
* Replace first parameter with 100% of return data.
    * `function bar(0, b, c)`



## Preparation before using dynamic parameter
* Know config setup detail
* Know every cube return data (type and count)
* Know the index of all return data in localStack
0* Know which cube return data will be reference
* Know which cube need to use dynamic parameter and which return data will be referenced
