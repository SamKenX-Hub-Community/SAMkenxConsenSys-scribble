/// This file is auto-generated by Scribble and shouldn't be edited directly.
/// Use --disarm prior to make any changes.
pragma solidity 0.5.11;

contract FooToken {
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    struct vars0 {
        uint256 old_0;
    }

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor() public {
        _totalSupply = 1000000;
        _balances[msg.sender] = 1000000;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address _owner) external view returns (uint256) {
        return _balances[_owner];
    }

    function allowance(address _owner, address _spender) external view returns (uint256) {
        return _allowances[_owner][_spender];
    }

    function transfer(address _to, uint256 _value) external returns (bool RET_0) {
        vars0 memory _v;
        _v.old_0 = _balances[msg.sender] + _balances[_to];
        RET_0 = _original_FooToken_transfer(_to, _value);
        if (!(_v.old_0 == (_balances[msg.sender] + _balances[_to]))) {
            __ScribbleUtilsLib__237.assertionFailed("001313:0064:000 0: P0");
            assert(false);
        }
    }

    function _original_FooToken_transfer(address _to, uint256 _value) private returns (bool) {
        address from = msg.sender;
        require(_value <= _balances[from]);
        uint256 newBalanceFrom = _balances[from] - _value;
        uint256 newBalanceTo = _balances[_to] + _value;
        _balances[from] = newBalanceFrom;
        _balances[_to] = newBalanceTo;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) external returns (bool) {
        address owner = msg.sender;
        _allowances[owner][_spender] = _value;
        emit Approval(owner, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
        uint256 allowed = _allowances[_from][msg.sender];
        require(_value <= allowed);
        require(_value <= _balances[_from]);
        _balances[_from] -= _value;
        _balances[_to] += _value;
        _allowances[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}

library __ScribbleUtilsLib__237 {
    event AssertionFailed(string message);

    event AssertionFailedData(int eventId, bytes encodingData);

    function assertionFailed(string memory arg_0) internal {
        emit AssertionFailed(arg_0);
    }

    function assertionFailedData(int arg_0, bytes memory arg_1) internal {
        emit AssertionFailedData(arg_0, arg_1);
    }

    function isInContract() internal returns (bool res) {
        assembly {
            res := sload(0x5f0b92cf9616afdee4f4136f66393f1343b027f01be893fa569eb2e2b667a40c)
        }
    }

    function setInContract(bool v) internal {
        assembly {
            sstore(0x5f0b92cf9616afdee4f4136f66393f1343b027f01be893fa569eb2e2b667a40c, v)
        }
    }
}
