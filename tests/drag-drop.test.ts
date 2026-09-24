import { expect, test } from "bun:test";
import { dragConfiguration } from "../packages/drag-drop/src/contracts";
test("drag contracts preserve built-in compatibility and explicit move/custom data", () => {
  expect(JSON.parse(dragConfiguration({ text: "text" }, {}, "macos"))).toEqual({ sourceOperations: ["copy"], acceptedOperations: ["copy"], acceptedTypes: ["files", "text", "urls"] });
  expect(JSON.parse(dragConfiguration({ data: { "application/x-playlist": '{"id":42}' } }, { sourceOperations: ["copy", "move"], acceptedOperations: ["move"], acceptedTypes: ["application/x-playlist"] }, "windows"))).toMatchObject({ acceptedOperations: ["move"], acceptedTypes: ["application/x-playlist"] });
  expect(() => dragConfiguration({ files: [String.raw`C:\Music\track.mp3`] }, {}, "windows")).not.toThrow();
});
test("drag contracts reject ambiguous operations and invalid custom representations", () => {
  for (const operations of [["delete"], ["move", "move"]]) expect(() => dragConfiguration(undefined, { sourceOperations: operations as never }, "macos")).toThrow();
  for (const type of ["bad format", "application/x-spark-drag", "text/plain", "text/uri-list"]) expect(() => dragConfiguration({ data: { [type]: "data" } }, {}, "macos")).toThrow();
  expect(() => dragConfiguration({ data: { "application/x-item": {} as never } }, {}, "macos")).toThrow();
  expect(() => dragConfiguration({ files: ["relative.txt"] }, {}, "macos")).toThrow("absolute");
  expect(JSON.parse(dragConfiguration(undefined, { acceptedOperations: [], acceptedTypes: [] }, "macos"))).toMatchObject({ acceptedOperations: [], acceptedTypes: [] });
});
