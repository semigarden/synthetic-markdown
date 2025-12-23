import type { Block, CodeBlock, HTMLBlock, List, ListItem } from "../types/block"
import { renderInline } from "./renderInline"
import { escape } from "../utils/escape"

function renderBlock(block: Block): string {
    switch (block.type) {
        case "document":
            return block.children.map(renderBlock).join("")

        case "heading":
            return `<h${block.level}>${block.children.map(renderInline).join("")}</h${block.level}>`

        case "paragraph":
            return `<p>${block.children.map(renderInline).join("")}</p>`

        case "blockQuote":
            return `<blockquote>${block.children.map(renderBlock).join("")}</blockquote>`

        case "thematicBreak":
            return `<hr />`

        case "codeBlock": {
            const codeBlock = block as CodeBlock
            const lang = codeBlock.language
                ? ` class="language-${escape(codeBlock.language)}"`
                : ""
            return `<pre><code${lang}>${escape(codeBlock.code)}</code></pre>`
        }

        case "htmlBlock":
            return (block as HTMLBlock).html

        case "lineBreak":
            return "<br />"

        case "list": {
            const list = block as List
            const tag = list.ordered ? "ol" : "ul"
            const startAttr =
                list.ordered && list.start !== undefined && list.start !== 1
                    ? ` start="${list.start}"`
                    : ""
            return `<${tag}${startAttr}>${list.children.map(renderBlock).join("")}</${tag}>`
        }

        case "listItem":
            return `<li>${(block as ListItem).children.map(renderBlock).join("")}</li>`

        default:
            return ""
    }
}

export { renderBlock }
