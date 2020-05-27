pragma solidity ^0.5.0;


contract Config {
    // function signature of "postProcess()"
    bytes4 constant POSTPROCESS_SIG = 0xc2722916;

    enum HandlerType {Token, Custom, Others}
}
