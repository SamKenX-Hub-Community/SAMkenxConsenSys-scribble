/// This file is auto-generated by Scribble and shouldn't be edited directly.
/// Use --disarm prior to make any changes.
pragma solidity 0.8.7;

/// #invariant sum < 200;
contract AssertMixed {
    struct vars1 {
        bool __scribble_check_invs_at_end;
    }

    struct vars2 {
        uint256 i0;
        bool forall_0;
    }

    struct vars3 {
        uint256 old_0;
    }

    uint internal sum;

    function main(uint[] memory n) public {
        vars1 memory _v;
        _v.__scribble_check_invs_at_end = !__ScribbleUtilsLib__34.isInContract();
        __ScribbleUtilsLib__34.setInContract(true);
        _original_AssertMixed_main(n);
        unchecked {
            if (!(n.length < 10)) {
                emit __ScribbleUtilsLib__34.AssertionFailed("000720:0066:000 2: ");
                assert(false);
            }
        }
        if (_v.__scribble_check_invs_at_end) __scribble_check_state_invariants();
        __ScribbleUtilsLib__34.setInContract(!_v.__scribble_check_invs_at_end);
    }

    function _original_AssertMixed_main(uint[] memory n) private {
        vars2 memory _v;
        unchecked {
            _v.forall_0 = true;
            for (_v.i0 = 0; _v.i0 < n.length; _v.i0++) {
                _v.forall_0 = n[_v.i0] <= 50;
                if (!_v.forall_0) break;
            }
            if (!(_v.forall_0)) {
                emit __ScribbleUtilsLib__34.AssertionFailed("001364:0066:000 3: ");
                assert(false);
            }
        }
        for (uint i = 0; i < n.length; i++) {
            unchecked {
                if (!(n[i] > 2)) {
                    emit __ScribbleUtilsLib__34.AssertionFailed("001612:0066:000 4: ");
                    assert(false);
                }
            }
            AssertMixed_sum_uint256_plus_assign(n[i]);
        }
    }

    /// Check only the current contract's state invariants
    function __scribble_AssertMixed_check_state_invariants_internal() internal {
        unchecked {
            if (!(sum < 200)) {
                emit __ScribbleUtilsLib__34.AssertionFailed("002027:0066:000 0: ");
                assert(false);
            }
        }
    }

    /// Check the state invariant for the current contract and all its bases
    function __scribble_check_state_invariants() virtual internal {
        __scribble_AssertMixed_check_state_invariants_internal();
    }

    constructor() {
        __ScribbleUtilsLib__34.setInContract(true);
        __scribble_check_state_invariants();
        __ScribbleUtilsLib__34.setInContract(false);
    }

    function AssertMixed_sum_uint256_plus_assign(uint256 ARG0) internal returns (uint256 RET0) {
        vars3 memory _v;
        unchecked {
            _v.old_0 = sum;
        }
        sum += ARG0;
        RET0 = sum;
        unchecked {
            if (!((sum - _v.old_0) > 3)) {
                emit __ScribbleUtilsLib__34.AssertionFailed("002852:0066:000 1: ");
                assert(false);
            }
        }
    }
}

library __ScribbleUtilsLib__34 {
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
