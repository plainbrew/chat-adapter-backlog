import {
  BaseFormatConverter,
  type Root,
  parseMarkdown,
  stringifyMarkdown,
  type AdapterPostableMessage,
} from "chat";

export class BacklogFormatConverter extends BaseFormatConverter {
  toAst(platformText: string): Root {
    return parseMarkdown(this.backlogToMarkdown(platformText));
  }

  fromAst(ast: Root): string {
    return this.markdownToBacklog(stringifyMarkdown(ast));
  }

  override renderPostable(message: AdapterPostableMessage): string {
    return super.renderPostable(message);
  }

  private backlogToMarkdown(text: string): string {
    return text
      // Headers: *** → ###, ** → ##, * → #  (order matters: most specific first)
      .replace(/^\*{5} (.+)$/gm, "##### $1")
      .replace(/^\*{4} (.+)$/gm, "#### $1")
      .replace(/^\*{3} (.+)$/gm, "### $1")
      .replace(/^\*{2} (.+)$/gm, "## $1")
      .replace(/^\* (.+)$/gm, "# $1")
      // Bold: ''text'' → **text**
      .replace(/''/g, "**")
      // Strikethrough: %%text%% → ~~text~~
      .replace(/%%(.+?)%%/gms, "~~$1~~")
      // Code block: {code:lang}...{/code} or {code}...{/code}
      .replace(/\{code(?::([^}]+))?\}([\s\S]*?)\{\/code\}/gm, (_, lang, code) =>
        lang ? `\`\`\`${lang}\n${code}\`\`\`` : `\`\`\`\n${code}\`\`\``
      )
      // Links: [[text:URL]] → [text](URL), [[URL]] → <URL>
      .replace(/\[\[([^\]]+?):([^\]]+?)\]\]/g, "[$1]($2)")
      .replace(/\[\[([^\]]+?)\]\]/g, "<$1>")
      // Ordered lists: + item → 1. item
      .replace(/^\+ (.+)$/gm, "1. $1");
  }

  private markdownToBacklog(text: string): string {
    return text
      // Headers: ##### → *****, #### → ****, ### → ***, ## → **, # → *
      .replace(/^#{5} (.+)$/gm, "***** $1")
      .replace(/^#{4} (.+)$/gm, "**** $1")
      .replace(/^#{3} (.+)$/gm, "*** $1")
      .replace(/^#{2} (.+)$/gm, "** $1")
      .replace(/^# (.+)$/gm, "* $1")
      // Bold: **text** → ''text''
      .replace(/\*\*(.+?)\*\*/gs, "''$1''")
      // Strikethrough: ~~text~~ → %%text%%
      .replace(/~~(.+?)~~/gs, "%%$1%%")
      // Code block: ```lang\n...\n``` → {code:lang}...{/code}
      .replace(/```(\w+)?\n([\s\S]*?)```/gm, (_, lang, code) =>
        lang ? `{code:${lang}}\n${code}{/code}` : `{code}\n${code}{/code}`
      )
      // Links: [text](URL) → [[text:URL]], <URL> → [[URL]]
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[[$1:$2]]")
      .replace(/<(https?:[^>]+)>/g, "[[$1]]")
      // Ordered lists: 1. item → + item
      .replace(/^\d+\. (.+)$/gm, "+ $1");
  }
}
