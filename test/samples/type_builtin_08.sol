pragma solidity 0.8.8;

enum A {
    A,
    B,
    C
}

type Price is uint32;

interface IFace {
    function foo() external;
}

contract Boo {
    function foo() external {}
}

contract UserDefinedValueTypes {
    type Quantity is uint32;

    /// #if_succeeds a >= type(uint32).min && a <= type(uint32).max;
    /// #if_succeeds b >= type(int64).min && b <= type(int64).max;
    /// #if_succeeds c != type(A).min && c != type(A).max;
    /// #if_succeeds keccak256(bytes(type(IFace).name)) == keccak256(bytes("IFace"));
    /// #if_succeeds keccak256(type(Boo).creationCode) == bytes32(0x0);
    /// #if_succeeds keccak256(type(Boo).runtimeCode) == bytes32(0x0);
    /// #if_succeeds type(IFace).interfaceId != bytes4(0x0);
    function main(uint32 a, int64 b, A c) public  {
    }
}