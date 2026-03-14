import {
  BaseFormatConverter,
  type Root,
  parseMarkdown,
  stringifyMarkdown,
} from "chat";

/**
 * Zenzap uses plain text with simple markdown support.
 * Mentions use the format `<@profileId>`.
 */
export class ZenzapFormatConverter extends BaseFormatConverter {
  toAst(platformText: string): Root {
    // Strip Zenzap mention syntax before parsing as markdown
    const normalized = platformText.replace(/<@([^>]+)>/g, "@$1");
    return parseMarkdown(normalized);
  }

  fromAst(ast: Root): string {
    return stringifyMarkdown(ast);
  }
}
