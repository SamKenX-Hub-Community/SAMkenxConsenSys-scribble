import { parse as parseExpr } from "../../src/spec-lang/expr_parser";
import { parse as parseType } from "../../src/spec-lang/type_parser";
import expect from "expect";
import {
    SNode,
    SId,
    SNumber,
    SBooleanLiteral,
    SUnaryOperation,
    SBinaryOperation,
    SMemberAccess,
    SIndexAccess,
    SFunctionCall,
    SConditional,
    SLet,
    SAddressType,
    SBoolType,
    SIntType,
    SFixedBytes,
    SBytes,
    SString,
    SArrayType,
    SUserDefinedType,
    SMappingType,
    SPointer,
    SFunctionType,
    SResult
} from "../../src/spec-lang/ast";
import { eq } from "../../src/util/struct_equality";
import bigInt from "big-integer";
import { DataLocation, FunctionVisibility, FunctionStateMutability } from "solc-typed-ast";
import { Logger } from "../../src/logger";

describe("Expression Parser Unit Tests", () => {
    const goodSamples: Array<[string, SNode]> = [
        // Literals
        ["abcd", new SId("abcd")],
        ["1234", new SNumber(bigInt(1234), 10)],
        ["0x123abc", new SNumber(bigInt(0x123abc), 16)],
        ["true", new SBooleanLiteral(true)],
        ["false", new SBooleanLiteral(false)],
        // ops
        ["-1", new SUnaryOperation("-", new SNumber(bigInt(1), 10))],
        ["--a", new SUnaryOperation("-", new SUnaryOperation("-", new SId("a")))],
        ["!-a", new SUnaryOperation("!", new SUnaryOperation("-", new SId("a")))],
        // Binary ops
        // Power
        [
            "43**0x9",
            new SBinaryOperation(new SNumber(bigInt(43), 10), "**", new SNumber(bigInt(9), 16))
        ],
        [
            "2**2**3",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(2), 10), "**", new SNumber(bigInt(2), 10)),
                "**",
                new SNumber(bigInt(3), 10)
            )
        ],
        // Multiplicative
        [
            "43*0x9",
            new SBinaryOperation(new SNumber(bigInt(43), 10), "*", new SNumber(bigInt(9), 16))
        ],
        [
            "43*0x9*a",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(43), 10), "*", new SNumber(bigInt(9), 16)),
                "*",
                new SId("a")
            )
        ],
        [
            "43*0x9/a",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(43), 10), "*", new SNumber(bigInt(9), 16)),
                "/",
                new SId("a")
            )
        ],
        [
            "43%0x9/a",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(43), 10), "%", new SNumber(bigInt(9), 16)),
                "/",
                new SId("a")
            )
        ],
        // Here left-to-right order matters for correctness. With the correct order this evals to 3, and with the wrong one to 1
        [
            "13%7/2",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(13), 10), "%", new SNumber(bigInt(7), 10)),
                "/",
                new SNumber(bigInt(2), 10)
            )
        ],
        // Additive
        [
            "43+0x9",
            new SBinaryOperation(new SNumber(bigInt(43), 10), "+", new SNumber(bigInt(9), 16))
        ],
        [
            "43-5",
            new SBinaryOperation(new SNumber(bigInt(43), 10), "-", new SNumber(bigInt(5), 10))
        ],
        [
            "43-5*6",
            new SBinaryOperation(
                new SNumber(bigInt(43), 10),
                "-",
                new SBinaryOperation(new SNumber(bigInt(5), 10), "*", new SNumber(bigInt(6), 10))
            )
        ],
        //assert(43-5*-6==73);
        [
            "43-5*-6",
            new SBinaryOperation(
                new SNumber(bigInt(43), 10),
                "-",
                new SBinaryOperation(
                    new SNumber(bigInt(5), 10),
                    "*",
                    new SUnaryOperation("-", new SNumber(bigInt(6), 10))
                )
            )
        ],
        //assert(43-5+6==44);
        [
            "43-5+6",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(43), 10), "-", new SNumber(bigInt(5), 10)),
                "+",
                new SNumber(bigInt(6), 10)
            )
        ],
        // Bitwise
        //assert(256 >> 4 == 16);
        [
            "256>>4",
            new SBinaryOperation(new SNumber(bigInt(256), 10), ">>", new SNumber(bigInt(4), 10))
        ],
        //assert(256 >> 4 >> 1 == 8);
        [
            "256>>4>>1",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SNumber(bigInt(256), 10),
                    ">>",
                    new SNumber(bigInt(4), 10)
                ),
                ">>",
                new SNumber(bigInt(1), 10)
            )
        ],
        // assert(256 << 4 << 1 == 2 ** 13);
        [
            "256<<4<<1",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SNumber(bigInt(256), 10),
                    "<<",
                    new SNumber(bigInt(4), 10)
                ),
                "<<",
                new SNumber(bigInt(1), 10)
            )
        ],
        // assert(3+4 << 1 == 14);
        // weird right?
        [
            "3+4<<1",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "+", new SNumber(bigInt(4), 10)),
                "<<",
                new SNumber(bigInt(1), 10)
            )
        ],
        // assert(3+2*2 << 1 == 14);
        [
            "3+2*2<<1",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SNumber(bigInt(3), 10),
                    "+",
                    new SBinaryOperation(
                        new SNumber(bigInt(2), 10),
                        "*",
                        new SNumber(bigInt(2), 10)
                    )
                ),
                "<<",
                new SNumber(bigInt(1), 10)
            )
        ],
        // assert(3*3 << 1 == 18);
        [
            "3*3<<1",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "*", new SNumber(bigInt(3), 10)),
                "<<",
                new SNumber(bigInt(1), 10)
            )
        ],
        // relational operators
        ["4>0", new SBinaryOperation(new SNumber(bigInt(4), 10), ">", new SNumber(bigInt(0), 10))],
        [
            "4+4<=8",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(4), 10), "+", new SNumber(bigInt(4), 10)),
                "<=",
                new SNumber(bigInt(8), 10)
            )
        ],
        [
            "-1*5>=-6",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SUnaryOperation("-", new SNumber(bigInt(1), 10)),
                    "*",
                    new SNumber(bigInt(5), 10)
                ),
                ">=",
                new SUnaryOperation("-", new SNumber(bigInt(6), 10))
            )
        ],
        [
            "3<<2>=6",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "<<", new SNumber(bigInt(2), 10)),
                ">=",
                new SNumber(bigInt(6), 10)
            )
        ],
        // Equality operators
        [
            "4 == 4",
            new SBinaryOperation(new SNumber(bigInt(4), 10), "==", new SNumber(bigInt(4), 10))
        ],
        [
            "3+1 == 2+2",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "+", new SNumber(bigInt(1), 10)),
                "==",
                new SBinaryOperation(new SNumber(bigInt(2), 10), "+", new SNumber(bigInt(2), 10))
            )
        ],
        [
            "3>1 == 2>=2",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), ">", new SNumber(bigInt(1), 10)),
                "==",
                new SBinaryOperation(new SNumber(bigInt(2), 10), ">=", new SNumber(bigInt(2), 10))
            )
        ],
        [
            "true == false == false",
            new SBinaryOperation(
                new SBinaryOperation(new SBooleanLiteral(true), "==", new SBooleanLiteral(false)),
                "==",
                new SBooleanLiteral(false)
            )
        ],
        // Bitwise binary operators
        [
            "3 & 4",
            new SBinaryOperation(new SNumber(bigInt(3), 10), "&", new SNumber(bigInt(4), 10))
        ],
        [
            "3 | 4",
            new SBinaryOperation(new SNumber(bigInt(3), 10), "|", new SNumber(bigInt(4), 10))
        ],
        [
            "3 ^ 4",
            new SBinaryOperation(new SNumber(bigInt(3), 10), "^", new SNumber(bigInt(4), 10))
        ],
        [
            "3 + 4 ^ 4",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "+", new SNumber(bigInt(4), 10)),
                "^",
                new SNumber(bigInt(4), 10)
            )
        ],
        [
            "3 ^ 4 & 4",
            new SBinaryOperation(
                new SNumber(bigInt(3), 10),
                "^",
                new SBinaryOperation(new SNumber(bigInt(4), 10), "&", new SNumber(bigInt(4), 10))
            )
        ],
        [
            "3 | 4 ^ 4",
            new SBinaryOperation(
                new SNumber(bigInt(3), 10),
                "|",
                new SBinaryOperation(new SNumber(bigInt(4), 10), "^", new SNumber(bigInt(4), 10))
            )
        ],
        [
            "true || false",
            new SBinaryOperation(new SBooleanLiteral(true), "||", new SBooleanLiteral(false))
        ],
        [
            "true && true",
            new SBinaryOperation(new SBooleanLiteral(true), "&&", new SBooleanLiteral(true))
        ],
        [
            "3<4 && 3^4 > 3",
            new SBinaryOperation(
                new SBinaryOperation(new SNumber(bigInt(3), 10), "<", new SNumber(bigInt(4), 10)),
                "&&",
                new SBinaryOperation(
                    new SBinaryOperation(
                        new SNumber(bigInt(3), 10),
                        "^",
                        new SNumber(bigInt(4), 10)
                    ),
                    ">",
                    new SNumber(bigInt(3), 10)
                )
            )
        ],
        [
            "false ==> true",
            new SBinaryOperation(new SBooleanLiteral(false), "==>", new SBooleanLiteral(true))
        ],
        [
            "3+4>1 ==> true",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SBinaryOperation(
                        new SNumber(bigInt(3), 10),
                        "+",
                        new SNumber(bigInt(4), 10)
                    ),
                    ">",
                    new SNumber(bigInt(1), 10)
                ),
                "==>",
                new SBooleanLiteral(true)
            )
        ],
        // We define implication to be right-associative.
        [
            "3+4>1 ==> true ==> 1==1",
            new SBinaryOperation(
                new SBinaryOperation(
                    new SBinaryOperation(
                        new SNumber(bigInt(3), 10),
                        "+",
                        new SNumber(bigInt(4), 10)
                    ),
                    ">",
                    new SNumber(bigInt(1), 10)
                ),
                "==>",
                new SBinaryOperation(
                    new SBooleanLiteral(true),
                    "==>",
                    new SBinaryOperation(
                        new SNumber(bigInt(1), 10),
                        "==",
                        new SNumber(bigInt(1), 10)
                    )
                )
            )
        ],
        // Member Expressions
        ["a.b", new SMemberAccess(new SId("a"), "b")],
        ["a.b.c", new SMemberAccess(new SMemberAccess(new SId("a"), "b"), "c")],
        [
            "1<a.b.c",
            new SBinaryOperation(
                new SNumber(bigInt(1), 10),
                "<",
                new SMemberAccess(new SMemberAccess(new SId("a"), "b"), "c")
            )
        ],
        // Index Expressions
        ["a[b]", new SIndexAccess(new SId("a"), new SId("b"))],
        [
            "a[b+c]",
            new SIndexAccess(new SId("a"), new SBinaryOperation(new SId("b"), "+", new SId("c")))
        ],
        [
            "a[b+c][d]",
            new SIndexAccess(
                new SIndexAccess(
                    new SId("a"),
                    new SBinaryOperation(new SId("b"), "+", new SId("c"))
                ),
                new SId("d")
            )
        ],
        [
            "a[d][b+c]",
            new SIndexAccess(
                new SIndexAccess(new SId("a"), new SId("d")),
                new SBinaryOperation(new SId("b"), "+", new SId("c"))
            )
        ],
        ["a.foo[b]", new SIndexAccess(new SMemberAccess(new SId("a"), "foo"), new SId("b"))],
        [
            "a[d].foo[b+c]",
            new SIndexAccess(
                new SMemberAccess(new SIndexAccess(new SId("a"), new SId("d")), "foo"),
                new SBinaryOperation(new SId("b"), "+", new SId("c"))
            )
        ],
        // Function calls
        ["a()", new SFunctionCall(new SId("a"), [])],
        ["a(1)", new SFunctionCall(new SId("a"), [new SNumber(bigInt(1), 10)])],
        [
            "a(1, 0x2+c)",
            new SFunctionCall(new SId("a"), [
                new SNumber(bigInt(1), 10),
                new SBinaryOperation(new SNumber(bigInt(2), 16), "+", new SId("c"))
            ])
        ],
        [
            "a(1, 0x2+c, x.f)",
            new SFunctionCall(new SId("a"), [
                new SNumber(bigInt(1), 10),
                new SBinaryOperation(new SNumber(bigInt(2), 16), "+", new SId("c")),
                new SMemberAccess(new SId("x"), "f")
            ])
        ],
        [
            "a.f(1)",
            new SFunctionCall(new SMemberAccess(new SId("a"), "f"), [new SNumber(bigInt(1), 10)])
        ],
        [
            "a.f[b](1)",
            new SFunctionCall(
                new SIndexAccess(new SMemberAccess(new SId("a"), "f"), new SId("b")),
                [new SNumber(bigInt(1), 10)]
            )
        ],
        [
            "a().f[b](1)",
            new SFunctionCall(
                new SIndexAccess(
                    new SMemberAccess(new SFunctionCall(new SId("a"), []), "f"),
                    new SId("b")
                ),
                [new SNumber(bigInt(1), 10)]
            )
        ],
        // Old expression (looks like a function call but is treated as a unary operation)
        ["old(a)", new SUnaryOperation("old", new SId("a"))],
        ["old(a).f", new SMemberAccess(new SUnaryOperation("old", new SId("a")), "f")],
        ["old(a)[f]", new SIndexAccess(new SUnaryOperation("old", new SId("a")), new SId("f"))],
        [
            "old(a+b)",
            new SUnaryOperation("old", new SBinaryOperation(new SId("a"), "+", new SId("b")))
        ],
        ["old(a)()", new SFunctionCall(new SUnaryOperation("old", new SId("a")), [])],
        // Conditional
        ["a?b:c", new SConditional(new SId("a"), new SId("b"), new SId("c"))],
        [
            "a?b+1:c-d",
            new SConditional(
                new SId("a"),
                new SBinaryOperation(new SId("b"), "+", new SNumber(bigInt(1), 10)),
                new SBinaryOperation(new SId("c"), "-", new SId("d"))
            )
        ],
        [
            "false || true ? false : true",
            new SConditional(
                new SBinaryOperation(new SBooleanLiteral(false), "||", new SBooleanLiteral(true)),
                new SBooleanLiteral(false),
                new SBooleanLiteral(true)
            )
        ],
        [
            "false || true ? 1 : 2",
            new SConditional(
                new SBinaryOperation(new SBooleanLiteral(false), "||", new SBooleanLiteral(true)),
                new SNumber(bigInt(1), 10),
                new SNumber(bigInt(2), 10)
            )
        ],
        [
            // ternaries have a  higher priority than || (this evaluates to true)
            "true ? true : false || false",
            new SConditional(
                new SBooleanLiteral(true),
                new SBooleanLiteral(true),
                new SBinaryOperation(new SBooleanLiteral(false), "||", new SBooleanLiteral(false))
            )
        ],
        [
            // ternaries associate to the right (this evaluates to true)
            "true ? true : false ? false : true",
            new SConditional(
                new SBooleanLiteral(true),
                new SBooleanLiteral(true),
                new SConditional(
                    new SBooleanLiteral(false),
                    new SBooleanLiteral(false),
                    new SBooleanLiteral(true)
                )
            )
        ],
        // Let expressions
        ["let a := 1 in a", new SLet([new SId("a")], new SNumber(bigInt(1), 10), new SId("a"))],
        [
            "let a := b+c in a",
            new SLet(
                [new SId("a")],
                new SBinaryOperation(new SId("b"), "+", new SId("c")),
                new SId("a")
            )
        ],
        [
            "let a := b+c in a*a",
            new SLet(
                [new SId("a")],
                new SBinaryOperation(new SId("b"), "+", new SId("c")),
                new SBinaryOperation(new SId("a"), "*", new SId("a"))
            )
        ],
        [
            "let a := let b := 1 in b+b in a*a",
            new SLet(
                [new SId("a")],
                new SLet(
                    [new SId("b")],
                    new SNumber(bigInt(1), 10),
                    new SBinaryOperation(new SId("b"), "+", new SId("b"))
                ),
                new SBinaryOperation(new SId("a"), "*", new SId("a"))
            )
        ],
        [
            "let a := let b := 1 in b+b in let c := a*a in c+1",
            new SLet(
                [new SId("a")],
                new SLet(
                    [new SId("b")],
                    new SNumber(bigInt(1), 10),
                    new SBinaryOperation(new SId("b"), "+", new SId("b"))
                ),
                new SLet(
                    [new SId("c")],
                    new SBinaryOperation(new SId("a"), "*", new SId("a")),
                    new SBinaryOperation(new SId("c"), "+", new SNumber(bigInt(1), 10))
                )
            )
        ],
        [
            "let a, b := foo() in a+b",
            new SLet(
                [new SId("a"), new SId("b")],
                new SFunctionCall(new SId("foo"), []),
                new SBinaryOperation(new SId("a"), "+", new SId("b"))
            )
        ],
        ["$result", new SResult()]
    ];

    const badSamples: string[] = [
        "0asdf",
        "0x123av",
        "123a",
        "a.1",
        "old",
        "old.foo",
        "old+1",
        "old[1]",
        "old(1,2)"
    ];

    for (const [sample, expectedAST] of goodSamples) {
        describe(`Sample ${sample}`, () => {
            it("Parses correctly", () => {
                const parsed = parseExpr(sample);
                expect(eq(parsed, expectedAST)).toEqual(true);
            });
        });
    }

    for (const sample of badSamples) {
        describe(`Sample ${sample}`, () => {
            it("Fails as expected", () => {
                expect(parseExpr.bind(parseExpr, sample)).toThrow();
            });
        });
    }
});

describe("Type Parser Unit Tests", () => {
    const goodSamples: Array<[string, SNode]> = [
        ["bool", new SBoolType()],
        ["address", new SAddressType(false)],
        ["address payable", new SAddressType(true)],
        ["uint", new SIntType(256, false)],
        ["int", new SIntType(256, true)],
        ["int8", new SIntType(8, true)],
        ["uint16", new SIntType(16, false)],
        ["byte", new SFixedBytes(1)],
        ["bytes32", new SFixedBytes(32)],
        ["bytes21", new SFixedBytes(21)],
        ["bytes", new SBytes()],
        ["string", new SString()],
        ["uint[]", new SArrayType(new SIntType(256, false))],
        ["int8[7]", new SArrayType(new SIntType(8, true), 7)],
        ["string[][]", new SArrayType(new SArrayType(new SString()))],
        ["string[][3]", new SArrayType(new SArrayType(new SString()), 3)],
        ["string[3][]", new SArrayType(new SArrayType(new SString(), 3))],
        ["struct SomeType", new SUserDefinedType("SomeType")],
        ["enum SomeContract.SomeType", new SUserDefinedType("SomeContract.SomeType")],
        [
            "mapping (uint => int8)",
            new SMappingType(new SIntType(256, false), new SIntType(8, true))
        ],
        [
            "mapping (string => contract SomeType)",
            new SMappingType(new SString(), new SUserDefinedType("SomeType"))
        ],
        [
            "mapping (string => mapping (bytes => bool))",
            new SMappingType(new SString(), new SMappingType(new SBytes(), new SBoolType()))
        ],
        [
            "uint[] storage",
            new SPointer(new SArrayType(new SIntType(256, false)), DataLocation.Storage)
        ],
        [
            "struct SomeT calldata",
            new SPointer(new SUserDefinedType("SomeT"), DataLocation.CallData)
        ],
        [
            "mapping (string => string) memory",
            new SPointer(new SMappingType(new SString(), new SString()), DataLocation.Memory)
        ],
        [
            "function ()",
            new SFunctionType(
                [],
                [],
                FunctionVisibility.Internal,
                FunctionStateMutability.NonPayable
            )
        ],
        [
            "function (uint)",
            new SFunctionType(
                [new SIntType(256, false)],
                [],
                FunctionVisibility.Internal,
                FunctionStateMutability.NonPayable
            )
        ],
        [
            "function (uint) returns (uint)",
            new SFunctionType(
                [new SIntType(256, false)],
                [new SIntType(256, false)],
                FunctionVisibility.Internal,
                FunctionStateMutability.NonPayable
            )
        ],
        [
            "function (uint, string) returns (uint)",
            new SFunctionType(
                [new SIntType(256, false), new SString()],
                [new SIntType(256, false)],
                FunctionVisibility.Internal,
                FunctionStateMutability.NonPayable
            )
        ],
        [
            "function (uint, string memory) returns (uint)",
            new SFunctionType(
                [new SIntType(256, false), new SPointer(new SString(), DataLocation.Memory)],
                [new SIntType(256, false)],
                FunctionVisibility.Internal,
                FunctionStateMutability.NonPayable
            )
        ],
        [
            "function (uint, string memory) external view returns (uint)",
            new SFunctionType(
                [new SIntType(256, false), new SPointer(new SString(), DataLocation.Memory)],
                [new SIntType(256, false)],
                FunctionVisibility.External,
                FunctionStateMutability.View
            )
        ],
        [
            "function (uint, string memory) internal pure returns (uint)",
            new SFunctionType(
                [new SIntType(256, false), new SPointer(new SString(), DataLocation.Memory)],
                [new SIntType(256, false)],
                FunctionVisibility.Internal,
                FunctionStateMutability.Pure
            )
        ]
    ];

    const badSamples: string[] = [];

    for (const [sample, expectedAST] of goodSamples) {
        describe(`Sample ${sample}`, () => {
            it("Parses correctly", () => {
                const parsed = parseType(sample);
                Logger.debug(`[${sample}]: Got: ${parsed.pp()} expected: ${expectedAST.pp()}`);
                expect(eq(parsed, expectedAST)).toEqual(true);
            });
        });
    }

    for (const sample of badSamples) {
        describe(`Sample ${sample}`, () => {
            it("Fails as expected", () => {
                expect(parseType.bind(parseType, sample)).toThrow();
            });
        });
    }
});