import expect from "expect";
import fse from "fs-extra";
import { join } from "path";
import { cwd } from "process";
import { assert } from "solc-typed-ast";
import {
    contains,
    InstrumentationMetaData,
    OriginalJSONLoc,
    parseSrcTriple,
    searchRecursive
} from "../../src/util";
import { loc2Src, scribble } from "./utils";

function checkSrc(src: string, fileList: string[], fileContents: Map<string, string>): void {
    const [off, len, fileIdx] = parseSrcTriple(src);

    assert(
        fileIdx >= 0 && fileIdx < fileList.length,
        "Invalid file index {0} for source list {1}",
        fileIdx,
        fileList
    );

    const fileName = fileList[fileIdx];
    const contents = fileContents.get(fileName) as string;

    assert(contents !== undefined, "File {0} missing from file map {1}", fileName, fileContents);

    assert(
        off >= 0 && off < contents.length && len > 0 && off + len <= contents.length,
        `Src range ${off}:${len} out of bounds for contents of file ${fileName}: 0-${contents.length}`
    );
}

function checkLoc(
    loc: OriginalJSONLoc,
    fileList: string[],
    fileContents: Map<string, string>
): void {
    if (loc instanceof Array) {
        loc.forEach((src) => checkSrc(src, fileList, fileContents));
        return;
    }

    checkSrc(loc, fileList, fileContents);
}

export function fragment(
    src: string,
    fileList: string[],
    fileContents: Map<string, string>
): string {
    const [off, len, fileIdx] = parseSrcTriple(src);
    const fileName = fileList[fileIdx];
    const contents = fileContents.get(fileName) as string;
    return contents.slice(off, off + len);
}

describe("Multiple-file project instrumentation", () => {
    const samples: Array<[string, string[], string, string[]]> = [
        ["test/multifile_samples/proj1", ["child1.sol", "child2.sol"], "0.6.11", []],
        [
            "test/multifile_samples/import_rewrites",
            ["main.sol", "imp1.sol", "imp2.sol", "imp3.sol"],
            "0.6.11",
            []
        ],
        ["test/multifile_samples/inheritance1", ["C.sol", "D.sol"], "0.6.11", []],
        [
            "test/multifile_samples/reexported_imports",
            ["main.sol", "imp1.sol", "imp2.sol", "imp3.sol"],
            "0.7.5",
            []
        ],
        [
            "test/multifile_samples/reexported_imports_05",
            ["main.sol", "imp1.sol", "imp2.sol", "imp3.sol"],
            "0.5.0",
            []
        ],
        ["test/multifile_samples/forall_maps", ["child.sol", "base.sol"], "0.8.4", []],
        ["test/multifile_samples/arr_sum", ["main.sol"], "0.8.4", []],
        ["test/multifile_samples/asserts", ["C.sol", "B.sol", "A.sol"], "0.8.7", []],
        ["test/multifile_samples/circular_imports", ["B.sol", "A.sol"], "0.8.7", []],
        [
            "test/multifile_samples/macros",
            ["base.sol", "child.sol"],
            "0.8.7",
            ["--macro-path", "test/multifile_samples/macros"]
        ]
    ];

    for (const [dirName, solFiles, version, additionalArgs] of samples) {
        describe(`Multi-file Sample ${dirName}`, () => {
            const solPaths: string[] = solFiles.map((name) => join(dirName, name));
            let expectedInstrumented: Map<string, string>;
            let expectedFlat: string;
            let expectedInstrMetadata: any;

            before(() => {
                const expectedInstrumentedFiles = searchRecursive(dirName, (fileName) =>
                    fileName.endsWith(".sol.instrumented.expected")
                );

                expectedInstrumented = new Map(
                    expectedInstrumentedFiles.map((fileName) => [
                        fileName,
                        fse.readFileSync(fileName, "utf-8")
                    ])
                );

                expectedFlat = fse.readFileSync(`${dirName}/flat.sol.expected`, {
                    encoding: "utf-8"
                });

                // Uncomment below lines to re-generate instrumentationMetadata.json.expected
                /*
                scribble(
                    solPaths,
                    "-o",
                    "--",
                    "--output-mode",
                    "json",
                    "--compiler-version",
                    version,
                    "--debug-events",
                    "--instrumentation-metadata-file",
                    `${dirName}/instrumentationMetadata.json.expected`,
                    ...additionalArgs
                );
                */

                expectedInstrMetadata = fse.readJSONSync(
                    `${dirName}/instrumentationMetadata.json.expected`,
                    {
                        encoding: "utf-8"
                    }
                ) as InstrumentationMetaData;

                // Nit: Macro paths are absolute, so we adjust them here accordingly
                for (let i = 0; i < expectedInstrMetadata.originalSourceList.length; i++) {
                    const name = expectedInstrMetadata.originalSourceList[i];
                    if (name.endsWith(".yaml") || name.endsWith(".yml")) {
                        expectedInstrMetadata.originalSourceList[i] = join(cwd(), name);
                    }
                }
            });

            it("Flat mode is correct", () => {
                const actualFlat = scribble(
                    solPaths,
                    "-o",
                    "--",
                    "--compiler-version",
                    version,
                    ...additionalArgs
                );

                expect(actualFlat.trim()).toEqual(expectedFlat.trim());
            });

            it("Instrumented files are correct", () => {
                scribble(
                    solPaths,
                    "--output-mode",
                    "files",
                    "--quiet",
                    "--compiler-version",
                    version,
                    ...additionalArgs
                );

                for (const [fileName, expectedContents] of expectedInstrumented) {
                    const atualInstr = fse.readFileSync(
                        fileName.replace(".sol.instrumented.expected", ".sol.instrumented"),
                        "utf-8"
                    );

                    expect(atualInstr).toEqual(expectedContents);
                }
            });

            it("Instrumentation metadata is what we expect", () => {
                const actualJsonStr = scribble(
                    solPaths,
                    "-o",
                    "--",
                    "--output-mode",
                    "json",
                    "--compiler-version",
                    version,
                    "--debug-events",
                    ...additionalArgs
                );

                const actualJson = JSON.parse(actualJsonStr);
                const instrMetadata = actualJson.instrumentationMetadata;

                /**
                 * Skip content check for version
                 */
                delete instrMetadata.scribbleVersion;

                expect(instrMetadata).toEqual(expectedInstrMetadata);
            });

            it("In-place arming works", () => {
                scribble(
                    solPaths,
                    "--output-mode",
                    "files",
                    "--quiet",
                    "--arm",
                    "--compiler-version",
                    version,
                    ...additionalArgs
                );

                for (const [fileName, expectedContents] of expectedInstrumented) {
                    const atualInstr = fse.readFileSync(
                        fileName.replace(".sol.instrumented.expected", ".sol"),
                        "utf-8"
                    );
                    expect(atualInstr).toEqual(expectedContents);

                    const originalFileName = fileName.replace(
                        ".sol.instrumented.expected",
                        ".sol.original"
                    );

                    expect(fse.existsSync(originalFileName)).toEqual(true);
                }
            });

            it("In-place dis-arming works", () => {
                scribble(
                    solPaths,
                    "--output-mode",
                    "files",
                    "--quiet",
                    "--disarm",
                    "--compiler-version",
                    version,
                    ...additionalArgs
                );

                for (const [fileName, expectedContents] of expectedInstrumented) {
                    const instrFileName = fileName.replace(
                        ".sol.instrumented.expected",
                        ".sol.instrumented"
                    );

                    const atualInstr = fse.readFileSync(
                        fileName.replace(".sol.instrumented.expected", ".sol"),
                        "utf-8"
                    );

                    expect(atualInstr).not.toEqual(expectedContents);
                    expect(fse.existsSync(instrFileName)).toEqual(false);

                    const originalFileName = fileName.replace(
                        ".sol.instrumented.expected",
                        ".sol.original"
                    );

                    expect(fse.existsSync(originalFileName)).toEqual(false);
                }
            });

            it("Multi-file instrumentation metadata is correct(ish)", () => {
                scribble(
                    solPaths,
                    "--output-mode",
                    "files",
                    "--quiet",
                    "--compiler-version",
                    version,
                    "--instrumentation-metadata-file",
                    "tmp.json",
                    ...additionalArgs
                );

                const md: InstrumentationMetaData = JSON.parse(
                    fse.readFileSync("tmp.json", { encoding: "utf-8" })
                );

                const originalFiles = new Map<string, string>(
                    md.originalSourceList.map((filename) => [
                        filename,
                        fse.readFileSync(filename, { encoding: "utf-8" })
                    ])
                );

                const instrFiles = new Map<string, string>(
                    md.instrSourceList.map((filename) => [
                        filename,
                        fse.readFileSync(filename, { encoding: "utf-8" })
                    ])
                );

                for (const originalFile of md.originalSourceList) {
                    expect(originalFiles.has(originalFile)).toBeTruthy();
                }

                for (const instrFile of md.instrSourceList) {
                    expect(instrFiles.has(instrFile)).toBeTruthy();
                }

                // Check source ranges in the instr-to-original map are sane
                for (const [instrSrc, originalSrc] of md.instrToOriginalMap) {
                    checkSrc(instrSrc, md.instrSourceList, instrFiles);
                    checkLoc(originalSrc, md.originalSourceList, originalFiles);
                }

                // Check general instrumentation source ranges are sane
                for (const src of md.otherInstrumentation) {
                    checkSrc(src, md.instrSourceList, instrFiles);
                }

                // Check src ranges in property map are correct
                for (const prop of md.propertyMap) {
                    checkLoc(prop.annotationSource, md.originalSourceList, originalFiles);
                    checkLoc(prop.propertySource, md.originalSourceList, originalFiles);

                    assert(
                        contains(
                            parseSrcTriple(loc2Src(prop.annotationSource)),
                            parseSrcTriple(loc2Src(prop.propertySource))
                        ),
                        `Annotation src ${prop.annotationSource} doesn't include predicate src ${prop.propertySource} for prop ${prop.id}`
                    );

                    for (const instrSrc of prop.instrumentationRanges) {
                        checkSrc(instrSrc, md.instrSourceList, instrFiles);
                    }

                    for (const src of prop.checkRanges) {
                        checkSrc(src, md.instrSourceList, instrFiles);
                    }

                    for (const [locs] of prop.debugEventEncoding) {
                        for (const loc of locs) {
                            checkLoc(loc, md.instrSourceList, instrFiles);
                        }
                    }
                }
            });
        });
    }
});
