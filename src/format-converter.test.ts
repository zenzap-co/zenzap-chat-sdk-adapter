import { describe, it, expect } from "vitest";
import { ZenzapFormatConverter } from "./format-converter";

const converter = new ZenzapFormatConverter();

describe("ZenzapFormatConverter", () => {
  describe("toAst", () => {
    it("should convert plain text to mdast", () => {
      const ast = converter.toAst("Hello world");
      expect(ast).toBeDefined();
      expect(ast.type).toBe("root");
      expect(ast.children.length).toBeGreaterThan(0);
    });

    it("should strip Zenzap mention syntax <@profileId> to @profileId before parsing", () => {
      const ast = converter.toAst("Hey <@user123> check this out");
      // The mention syntax should be stripped; the AST should contain @user123 as text
      const markdown = converter.fromAst(ast);
      expect(markdown).toContain("@user123");
      expect(markdown).not.toContain("<@user123>");
    });
  });

  describe("fromAst", () => {
    it("should produce markdown string", () => {
      const ast = converter.toAst("**bold** and *italic*");
      const result = converter.fromAst(ast);
      expect(typeof result).toBe("string");
      expect(result).toContain("bold");
      expect(result).toContain("italic");
    });
  });

  describe("roundtrip", () => {
    it("toAst then fromAst preserves content", () => {
      const original = "Hello world with some text";
      const ast = converter.toAst(original);
      const result = converter.fromAst(ast);
      expect(result.trim()).toBe(original);
    });
  });
});
