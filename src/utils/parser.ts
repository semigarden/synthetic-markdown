import type {
    Block,
    BlockQuote,
    CodeBlock,
    ContainerBlock,
    Document,
    Heading,
    HTMLBlock,
    List,
    ListItem,
    Paragraph,
    ThematicBreak,
} from "@/types/Block"
import type { Inline } from "@/types/Inline"

interface LinkReference {
    url: string
    title?: string
}

interface BlockContext {
    type: string
    node: Block
    parent: BlockContext | null
    canContinue(line: LineState): boolean
    addLine(text: string): void
    finalize(): void
}

class LineState {
    text: string
    pos: number = 0

    constructor(text: string) {
        this.text = text
    }

    skipIndent(max = 3) {
        let count = 0
        while (count < max && this.peek() === " ") {
            this.advance(1)
            count++
        }
        return count
    }

    countIndent() {
        let count = 0
        let pos = this.pos
        while (pos < this.text.length && this.text[pos] === " ") {
            count++
            pos++
        }
        return count
    }

    peek(n = 1) {
        return this.text.slice(this.pos, this.pos + n)
    }

    advance(n: number) {
        this.pos += n
    }

    remaining() {
        return this.text.slice(this.pos)
    }

    isBlank() {
        return this.remaining().trim() === ""
    }
}

function parseLinkReferenceDefinition(
    line: string,
): { label: string; url: string; title?: string } | null {
    const match = line.match(/^\[([^\]]+)\]:\s*(.+)$/)
    if (!match) return null

    const label = match[1].toLowerCase().trim()
    let rest = match[2].trim()

    let url = ""
    let title: string | undefined = undefined

    const titleMatch = rest.match(/^(.+?)\s+(["'])(.+?)\2\s*$/)
    if (titleMatch) {
        url = titleMatch[1].trim()
        title = titleMatch[3]
    } else {
        const titleParenMatch = rest.match(/^(.+?)\s+\((.+?)\)\s*$/)
        if (titleParenMatch) {
            url = titleParenMatch[1].trim()
            title = titleParenMatch[2]
        } else {
            url = rest
        }
    }

    if (url.startsWith("<") && url.endsWith(">")) {
        url = url.slice(1, -1)
    }

    return { label, url, title }
}

function tryOpenBlock(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    return (
        tryOpenHeading(line, parent) ??
        tryOpenCodeBlock(line, parent) ??
        tryOpenBlockQuote(line, parent) ??
        tryOpenList(line, parent) ??
        tryOpenThematicBreak(line, parent) ??
        tryOpenHTMLBlock(line, parent) ??
        tryOpenSetextHeading(line, parent) ??
        tryOpenParagraph(line, parent) ??
        tryOpenIndentedCodeBlock(line, parent) ??
        null
    )
}

function tryOpenHeading(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    let count = 0

    while (line.peek() === "#" && count < 6) {
        line.advance(1)
        count++
    }

    if (count === 0) return null
    if (line.peek() !== " " && line.peek() !== "") return null

    if (line.peek() === " ") line.advance(1)

    const node: Heading = {
        type: "heading",
        level: count,
        children: [],
    }

    let rawText = ""

    return {
        type: "heading",
        node,
        parent,
        canContinue() {
            return false
        },
        addLine(text) {
            rawText += (rawText ? " " : "") + text
        },
        finalize() {
            let doc: any = parent
            while (doc && doc.type !== "document") {
                doc = doc.parent
            }
            const linkRefs = doc?.node
                ? ((doc.node as any).__linkReferences as
                      | Map<string, LinkReference>
                      | undefined)
                : undefined
            node.children = parseInline(rawText.trim(), linkRefs)
        },
    }
}

function tryOpenSetextHeading(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null

    const text = line.remaining().trim()
    const setextMatch = text.match(/^(=+|-+)\s*$/)

    if (!setextMatch || setextMatch[1].length < 3) return null
    if (parent.node.children.length === 0) return null

    const lastChild = parent.node.children[parent.node.children.length - 1]
    if (lastChild.type !== "paragraph") return null

    return null
}

function tryOpenParagraph(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (parent.type === "paragraph") return null
    if (line.isBlank()) return null

    const node: Paragraph = {
        type: "paragraph",
        children: [],
    }

    const lines: Array<{ text: string; hardBreak: boolean }> = []
    let rawText = ""

    return {
        type: "paragraph",
        node,
        parent,
        canContinue(nextLine) {
            if (nextLine.isBlank()) return false

            const setextMatch = nextLine
                .remaining()
                .trim()
                .match(/^(=+|-+)\s*$/)
            if (setextMatch && setextMatch[1].length >= 3) {
                return true
            }

            const indent = nextLine.countIndent()
            if (indent >= 4 && !nextLine.isBlank()) {
                const checkLine = new LineState(nextLine.text)
                checkLine.skipIndent(4)
                const remaining = checkLine.remaining()

                if (
                    !remaining.match(/^([-*+]|\d+\.)\s+/) &&
                    !remaining.startsWith(">")
                ) {
                    return false
                }
            }

            if (wouldOpenBlock(nextLine, parent)) return false

            if (parent.type === "listItem" || parent.type === "list") {
                const savedPos = nextLine.pos
                nextLine.skipIndent(1000)
                const hasListMarker = !!(
                    nextLine.remaining().match(/^([-*+])\s+/) ||
                    nextLine.remaining().match(/^(\d+)\.\s+/)
                )
                nextLine.pos = savedPos
                if (hasListMarker) {
                    return false
                }
            }

            return true
        },
        addLine(text) {
            let hardBreak = false
            let lineText = text
            if (text.endsWith("\\")) {
                lineText = text.slice(0, -1)
                hardBreak = true
            } else if (text.endsWith("  ")) {
                lineText = text.slice(0, -2)
                hardBreak = true
            }
            lines.push({ text: lineText, hardBreak })
            rawText += (rawText ? " " : "") + lineText
        },
        finalize() {
            let doc: any = parent
            while (doc && doc.type !== "document") {
                doc = doc.parent
            }
            const linkRefs = doc?.node
                ? ((doc.node as any).__linkReferences as
                      | Map<string, LinkReference>
                      | undefined)
                : undefined
            node.children = parseInlineWithBreaks(lines, linkRefs)
        },
        rawText: () => rawText,
    } as BlockContext & { rawText: () => string }
}

function tryOpenBlockQuote(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (line.peek() !== ">") return null

    line.advance(1)
    if (line.peek() === " ") line.advance(1)

    const node: BlockQuote = {
        type: "blockQuote",
        children: [],
    }

    let previousLineHadMarker = true

    return {
        type: "blockQuote",
        node,
        parent,
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                previousLineHadMarker = false
                return false
            }
            if (nextLine.peek() === ">") {
                previousLineHadMarker = true
                return true
            }
            if (previousLineHadMarker) {
                return true
            }
            return false
        },
        addLine(_text) {
            previousLineHadMarker = _text.trimStart().startsWith(">")
        },
        finalize() {},
    }
}

function tryOpenThematicBreak(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null

    const text = line.remaining()

    const match = text.match(/^([*\-_])(?:\s*\1){2,}\s*$/)
    if (!match) return null

    const node: ThematicBreak = {
        type: "thematicBreak",
    }

    line.advance(text.length)

    return {
        type: "thematicBreak",
        node,
        parent,
        canContinue() {
            return false
        },
        addLine() {},
        finalize() {},
    }
}

function tryOpenCodeBlock(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null

    const text = line.remaining()
    const match = text.match(/^([`~]{3,})(\w*)\s*$/)
    if (!match) return null

    const fence = match[1]
    const language = match[2] || ""

    const node: CodeBlock = {
        type: "codeBlock",
        language,
        code: "",
    }

    line.advance(text.length)

    return {
        type: "codeBlock",
        node,
        parent,
        canContinue(nextLine) {
            const remaining = nextLine.remaining()
            const fenceChar = fence[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            return !remaining.match(
                new RegExp(`^${fenceChar}{${fence.length},}\\s*$`),
            )
        },
        addLine(text) {
            node.code += (node.code ? "\n" : "") + text
        },
        finalize() {
            node.code = node.code.trimEnd()
        },
    }
}

function tryOpenIndentedCodeBlock(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null

    const indent = line.countIndent()
    if (indent < 4) return null

    const checkLine = new LineState(line.text)
    checkLine.skipIndent(4)
    const remaining = checkLine.remaining()
    if (remaining.match(/^([-*+]|\d+\.)\s+/) || remaining.startsWith(">")) {
        return null
    }

    const node: CodeBlock = {
        type: "codeBlock",
        language: "",
        code: "",
    }

    return {
        type: "codeBlock",
        node,
        parent,
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                return true
            }

            const nextIndent = nextLine.countIndent()
            if (nextIndent >= 4) {
                const checkNextLine = new LineState(nextLine.text)
                checkNextLine.skipIndent(4)
                const nextRemaining = checkNextLine.remaining()
                if (
                    nextRemaining.match(/^([-*+]|\d+\.)\s+/) ||
                    nextRemaining.startsWith(">")
                ) {
                    return false
                }
                return true
            }
            return false
        },
        addLine(text) {
            const lineState = new LineState(text)
            const indent = lineState.countIndent()
            const indentToRemove = Math.min(4, indent)
            const content = text.slice(indentToRemove)
            node.code += (node.code ? "\n" : "") + content
        },
        finalize() {
            node.code = node.code.trimEnd()
        },
    }
}

function tryOpenHTMLBlock(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null

    const text = line.remaining().trim()
    const htmlBlockPattern =
        /^<(script|pre|style|textarea|iframe|object|embed|applet|noembed|noscript|form|fieldset|math|svg|table|hr|br|p|div|h[1-6]|ul|ol|dl|li|blockquote|address|article|aside|details|figcaption|figure|footer|header|hgroup|main|nav|section|summary)(\s|>|\/)/i
    if (!htmlBlockPattern.test(text)) return null

    const node: HTMLBlock = {
        type: "htmlBlock",
        html: "",
    }

    return {
        type: "htmlBlock",
        node,
        parent,
        canContinue(nextLine) {
            if (nextLine.isBlank()) return false
            const remaining = nextLine.remaining().trim()
            return remaining.startsWith("<") || remaining.length > 0
        },
        addLine(text) {
            node.html += (node.html ? "\n" : "") + decodeHTMLEntity(text)
        },
        finalize() {
            node.html = node.html.trim()
        },
    }
}

function tryOpenListItem(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    if (parent.type !== "list") return null

    const savedPos = line.pos
    const indent = line.countIndent()
    line.skipIndent(1000)
    let match

    if ((match = line.remaining().match(/^([-*+])\s+/))) {
        line.advance(match[0].length)
    } else if ((match = line.remaining().match(/^(\d+)\.\s+/))) {
        line.advance(match[0].length)
    } else {
        line.pos = savedPos
        return null
    }

    const markerIndent = indent
    const maxContentIndent = markerIndent + 4

    const node: ListItem = { type: "listItem", children: [] }
    let previousLineHadContent = false

    return {
        type: "listItem",
        node,
        parent,
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                previousLineHadContent = false
                return true
            }

            const savedNextPos = nextLine.pos
            const nextIndent = nextLine.countIndent()

            const checkLine = new LineState(nextLine.text)
            checkLine.skipIndent(1000)
            const remaining = checkLine.remaining()
            const hasListMarker = !!(
                remaining.match(/^([-*+])\s+/) || remaining.match(/^(\d+)\.\s+/)
            )

            if (hasListMarker && nextIndent <= markerIndent) {
                nextLine.pos = savedNextPos
                return false
            }

            if (hasListMarker && nextIndent > markerIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (previousLineHadContent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                return true
            }

            if (nextIndent > markerIndent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (nextIndent > maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (nextIndent < markerIndent) {
                nextLine.pos = savedNextPos
                return false
            }

            if (nextIndent >= markerIndent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            nextLine.pos = savedNextPos
            return false
        },
        addLine(text) {
            previousLineHadContent = true
            const lineIndent = new LineState(text).countIndent()
            const indentToRemove = Math.min(lineIndent, maxContentIndent)
            const content = text.slice(indentToRemove)

            if (
                node.children.length === 0 ||
                node.children[node.children.length - 1].type !== "paragraph"
            ) {
                const para: Paragraph = { type: "paragraph", children: [] }
                const paraAny = para as any
                paraAny.rawText = content
                node.children.push(para)
            } else {
                const lastPara = node.children[node.children.length - 1] as any
                lastPara.rawText = (lastPara.rawText || "") + " " + content
            }
        },
        finalize() {
            let doc: any = parent
            while (doc && doc.type !== "document") {
                doc = doc.parent
            }
            const linkRefs = doc?.node
                ? ((doc.node as any).__linkReferences as
                      | Map<string, LinkReference>
                      | undefined)
                : undefined

            for (const child of node.children) {
                if (child.type === "paragraph") {
                    const para = child as any
                    if (para.rawText !== undefined) {
                        para.children = parseInline(
                            para.rawText.trim(),
                            linkRefs,
                        )
                        delete para.rawText
                    }
                }
            }
        },
    }
}

function tryOpenList(
    line: LineState,
    parent: BlockContext,
): BlockContext | null {
    const savedPos = line.pos
    const indent = line.countIndent()
    line.skipIndent(1000)

    let ordered = false
    let start: number | undefined = undefined

    const unorderedMatch = line.remaining().match(/^([-*+])\s+/)
    const orderedMatch = line.remaining().match(/^(\d+)\.\s+/)

    if (unorderedMatch) {
        ordered = false
    } else if (orderedMatch) {
        ordered = true
        start = parseInt(orderedMatch[1], 10)
    } else {
        line.pos = savedPos
        return null
    }

    line.pos = savedPos

    const node: List = { type: "list", children: [], ordered, start }

    const baseIndent = indent

    return {
        type: "list",
        node,
        parent,
        canContinue(nextLine) {
            const savedNextPos = nextLine.pos
            const nextIndent = nextLine.countIndent()

            const checkLine = new LineState(nextLine.text)
            checkLine.skipIndent(1000)
            const remaining = checkLine.remaining()

            let canStartItem = false
            if (ordered) {
                canStartItem = !!remaining.match(/^(\d+)\.\s+/)
            } else {
                canStartItem = !!remaining.match(/^([-*+])\s+/)
            }

            if (parent.type === "listItem") {
                nextLine.pos = savedNextPos
                return canStartItem && nextIndent >= baseIndent
            }

            nextLine.pos = savedNextPos
            return canStartItem
        },
        addLine() {},
        finalize() {},
    }
}

function closeBlock(block: BlockContext) {
    block.finalize()

    if (block.parent && isContainerBlock(block.parent.node)) {
        block.parent.node.children.push(block.node)
    }
}

function isContainerBlock(node: Block): node is Block & ContainerBlock {
    return "children" in node
}

function wouldOpenBlock(line: LineState, parent: BlockContext) {
    return (
        tryOpenHeading(line, parent) ??
        tryOpenCodeBlock(line, parent) ??
        tryOpenBlockQuote(line, parent) ??
        tryOpenList(line, parent) ??
        tryOpenThematicBreak(line, parent) ??
        tryOpenHTMLBlock(line, parent) ??
        tryOpenIndentedCodeBlock(line, parent) ??
        null
    )
}

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

        case "codeBlock":
            const codeBlock = block as CodeBlock
            const lang = codeBlock.language
                ? ` class="language-${escape(codeBlock.language)}"`
                : ""
            return `<pre><code${lang}>${escape(codeBlock.code)}</code></pre>`

        case "htmlBlock":
            return (block as HTMLBlock).html

        case "list":
            const list = block as List
            const tag = list.ordered ? "ol" : "ul"
            const startAttr =
                list.ordered && list.start !== undefined && list.start !== 1
                    ? ` start="${list.start}"`
                    : ""
            return `<${tag}${startAttr}>${list.children.map(renderBlock).join("")}</${tag}>`

        case "listItem":
            return `<li>${(block as ListItem).children.map(renderBlock).join("")}</li>`

        default:
            return ""
    }
}

function escape(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

function parseBlock(text: string): Block {
    const document: Document = {
        type: "document",
        children: [],
    }

    const documentBlock: BlockContext = {
        type: "document",
        node: document,
        parent: null,
        canContinue: () => true,
        addLine: () => {},
        finalize: () => {},
    }

    const openBlocks: BlockContext[] = [documentBlock]
    const linkReferences = new Map<string, LinkReference>()

    const lines = text.split("\n")
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex]
        const line = new LineState(rawLine)

        const isAtDocumentLevel =
            openBlocks.length === 1 && openBlocks[0].type === "document"
        if (isAtDocumentLevel) {
            const definition = parseLinkReferenceDefinition(line.remaining())
            if (definition) {
                linkReferences.set(definition.label, {
                    url: definition.url,
                    title: definition.title,
                })
                continue
            }
        }

        let closedCodeBlock = false
        if (openBlocks.length > 0) {
            const lastBlock = openBlocks[openBlocks.length - 1]
            if (
                lastBlock.type === "paragraph" &&
                lastBlock.node.type === "paragraph"
            ) {
                const setextMatch = line
                    .remaining()
                    .trim()
                    .match(/^(=+|-+)\s*$/)
                if (setextMatch && setextMatch[1].length >= 3) {
                    const level = setextMatch[1][0] === "=" ? 1 : 2
                    const para = lastBlock.node as Paragraph

                    lastBlock.finalize()

                    const heading: Heading = {
                        type: "heading",
                        level,
                        children: para.children || [],
                    }

                    openBlocks.pop()
                    const parent = openBlocks[openBlocks.length - 1]
                    if (parent && isContainerBlock(parent.node)) {
                        const paraIndex = parent.node.children.indexOf(para)
                        if (paraIndex !== -1) {
                            parent.node.children.splice(paraIndex, 1)
                        }
                        parent.node.children.push(heading)
                    }
                    continue
                }
            }
        }

        for (let i = 0; i < openBlocks.length; i++) {
            const block = openBlocks[i]
            const checkLine = new LineState(rawLine)
            if (!block.canContinue(checkLine)) {
                if (block.type === "codeBlock") {
                    const remaining = checkLine.remaining().trim()
                    if (remaining.match(/^[`~]{3,}\s*$/)) {
                        closedCodeBlock = true
                    }
                }
                while (openBlocks.length > i) {
                    closeBlock(openBlocks.pop()!)
                }
                break
            }
        }

        while (true) {
            const parent = openBlocks[openBlocks.length - 1]

            if (parent.type === "list") {
                const newItem = tryOpenListItem(line, parent)
                if (newItem) {
                    openBlocks.push(newItem)
                    break
                }
            }

            if (parent.type === "listItem") {
                const newList = tryOpenList(line, parent)
                if (newList) {
                    openBlocks.push(newList)
                    continue
                }
            }

            const newBlock = tryOpenBlock(line, parent)
            if (!newBlock) break
            openBlocks.push(newBlock)
        }

        if (!closedCodeBlock) {
            const deepestBlock = openBlocks[openBlocks.length - 1]
            deepestBlock.addLine(line.remaining())
        }
    }

    while (openBlocks.length > 1) {
        closeBlock(openBlocks.pop()!)
    }

    ;(document as any).__linkReferences = linkReferences

    return document
}

function parseInlineWithBreaks(
    lines: Array<{ text: string; hardBreak: boolean }>,
    linkReferences?: Map<string, LinkReference>,
): Inline[] {
    const result: Inline[] = []

    for (let i = 0; i < lines.length; i++) {
        const { text, hardBreak } = lines[i]
        if (text.length > 0) {
            result.push(...parseInline(text, linkReferences))
        }

        if (i < lines.length - 1) {
            result.push({ type: hardBreak ? "HardBreak" : "SoftBreak" })
        }
    }

    return result
}

interface Delimiter {
    type: "*" | "_"
    length: number
    pos: number
    canOpen: boolean
    canClose: boolean
    node?: Inline
}

function decodeHTMLEntity(text: string): string {
    const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
    }

    for (const [entity, char] of Object.entries(entities)) {
        if (text.includes(entity)) {
            text = text.replace(
                new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                char,
            )
        }
    }

    text = text.replace(/&#(\d+);/g, (_, num) =>
        String.fromCharCode(parseInt(num, 10)),
    )
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
    )

    return text
}

function parseLinkDestinationAndTitle(
    text: string,
    start: number,
): { url: string; title?: string; end: number } | null {
    let pos = start
    if (pos >= text.length || text[pos] !== "(") return null
    pos++

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    if (pos >= text.length) return null

    let url = ""
    if (text[pos] === "<") {
        pos++
        const urlEnd = text.indexOf(">", pos)
        if (urlEnd === -1) return null
        url = text.slice(pos, urlEnd)
        pos = urlEnd + 1
    } else {
        const urlStart = pos
        while (pos < text.length && !/[ \t\n)]/.test(text[pos])) {
            if (text[pos] === "\\" && pos + 1 < text.length) {
                pos += 2
            } else {
                pos++
            }
        }
        url = text.slice(urlStart, pos)
        if (url.length === 0) return null
    }

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++

    let title: string | undefined = undefined
    if (
        pos < text.length &&
        (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")
    ) {
        const quoteChar = text[pos]
        pos++
        const titleStart = pos

        if (quoteChar === "(") {
            const titleEnd = text.indexOf(")", pos)
            if (titleEnd === -1) return null
            title = text.slice(pos, titleEnd)
            pos = titleEnd + 1
        } else {
            while (pos < text.length && text[pos] !== quoteChar) {
                if (text[pos] === "\\" && pos + 1 < text.length) {
                    pos += 2
                } else {
                    pos++
                }
            }
            if (pos >= text.length) return null
            title = text.slice(titleStart, pos)
            pos++
        }
    }

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++

    if (pos >= text.length || text[pos] !== ")") return null
    pos++

    return { url, title, end: pos }
}

function parseInline(
    text: string,
    linkReferences?: Map<string, LinkReference>,
): Inline[] {
    const result: Inline[] = []
    const delimiterStack: Delimiter[] = []
    let pos = 0
    let textStart = 0

    const addText = (start: number, end: number) => {
        if (end > start) {
            const textContent = text.slice(start, end)
            if (textContent.length > 0) {
                result.push({
                    type: "Text",
                    value: decodeHTMLEntity(textContent),
                })
            }
        }
    }

    const canBeOpener = (pos: number, type: "*" | "_"): boolean => {
        if (pos >= text.length) return false
        const prev = pos > 0 ? text[pos - 1] : " "
        const next = pos + 1 < text.length ? text[pos + 1] : " "

        if (type === "*") {
            return (
                !/\s/.test(next) &&
                (next !== "*" ||
                    (pos + 2 < text.length && !/\s/.test(text[pos + 2])))
            )
        } else {
            return !/[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next)
        }
    }

    const canBeCloser = (pos: number, type: "*" | "_"): boolean => {
        if (pos <= 0) return false
        const prev = pos > 0 ? text[pos - 1] : " "
        const next = pos + 1 < text.length ? text[pos + 1] : " "

        if (type === "*") {
            return (
                !/\s/.test(prev) &&
                (prev !== "*" || (pos - 2 >= 0 && !/\s/.test(text[pos - 2])))
            )
        } else {
            return /[a-zA-Z0-9]/.test(prev) && !/[a-zA-Z0-9]/.test(next)
        }
    }

    while (pos < text.length) {
        if (text[pos] === "\\" && pos + 1 < text.length) {
            const escaped = text[pos + 1]
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(escaped)) {
                addText(textStart, pos)
                result.push({ type: "Text", value: escaped })
                pos += 2
                textStart = pos
                continue
            }
        }

        if (text[pos] === "`") {
            addText(textStart, pos)
            let backtickCount = 1
            while (
                pos + backtickCount < text.length &&
                text[pos + backtickCount] === "`"
            ) {
                backtickCount++
            }

            let searchPos = pos + backtickCount
            let found = false
            while (searchPos < text.length) {
                if (text[searchPos] === "`") {
                    let closeCount = 1
                    while (
                        searchPos + closeCount < text.length &&
                        text[searchPos + closeCount] === "`"
                    ) {
                        closeCount++
                    }
                    if (closeCount === backtickCount) {
                        const codeContent = text.slice(
                            pos + backtickCount,
                            searchPos,
                        )
                        result.push({ type: "CodeSpan", value: codeContent })
                        pos = searchPos + backtickCount
                        textStart = pos
                        found = true
                        break
                    }
                    searchPos += closeCount
                } else {
                    searchPos++
                }
            }
            if (found) continue
        }

        if (text[pos] === "<") {
            const end = text.indexOf(">", pos + 1)
            if (end !== -1) {
                const content = text.slice(pos + 1, end)
                if (/^https?:\/\/|^ftp:\/\//i.test(content)) {
                    addText(textStart, pos)
                    result.push({ type: "Autolink", url: content })
                    pos = end + 1
                    textStart = pos
                    continue
                }
                if (
                    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
                        content,
                    )
                ) {
                    addText(textStart, pos)
                    result.push({ type: "Autolink", url: "mailto:" + content })
                    pos = end + 1
                    textStart = pos
                    continue
                }
            }
        }

        if (text[pos] === "<") {
            const htmlTagMatch = text
                .slice(pos)
                .match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/)
            if (htmlTagMatch) {
                const fullMatch = htmlTagMatch[0]
                const tagName = htmlTagMatch[2].toLowerCase()
                const inlineTags = [
                    "a",
                    "abbr",
                    "acronym",
                    "b",
                    "bdo",
                    "big",
                    "br",
                    "button",
                    "cite",
                    "code",
                    "dfn",
                    "em",
                    "i",
                    "img",
                    "input",
                    "kbd",
                    "label",
                    "map",
                    "object",
                    "output",
                    "q",
                    "samp",
                    "script",
                    "select",
                    "small",
                    "span",
                    "strong",
                    "sub",
                    "sup",
                    "textarea",
                    "time",
                    "tt",
                    "var",
                ]
                if (inlineTags.includes(tagName)) {
                    addText(textStart, pos)
                    result.push({ type: "HTML", html: fullMatch })
                    pos += fullMatch.length
                    textStart = pos
                    continue
                }
            }
        }

        if (
            text[pos] === "!" &&
            pos + 1 < text.length &&
            text[pos + 1] === "["
        ) {
            const linkEnd = text.indexOf("]", pos + 2)
            if (linkEnd !== -1) {
                const altText = text.slice(pos + 2, linkEnd)

                if (linkEnd + 1 < text.length && text[linkEnd + 1] === "(") {
                    const linkInfo = parseLinkDestinationAndTitle(
                        text,
                        linkEnd + 1,
                    )
                    if (linkInfo) {
                        addText(textStart, pos)
                        result.push({
                            type: "Image",
                            url: linkInfo.url,
                            alt: altText,
                            title: linkInfo.title,
                            children: [],
                        })
                        pos = linkInfo.end
                        textStart = pos
                        continue
                    }
                }

                if (linkReferences) {
                    let refLabel = ""
                    let refEnd = linkEnd + 1

                    if (
                        linkEnd + 1 < text.length &&
                        text[linkEnd + 1] === "["
                    ) {
                        const refEndPos = text.indexOf("]", linkEnd + 2)
                        if (refEndPos !== -1) {
                            refLabel = text
                                .slice(linkEnd + 2, refEndPos)
                                .toLowerCase()
                                .trim()
                            refEnd = refEndPos + 1
                        } else {
                            pos = linkEnd + 1
                            continue
                        }
                    } else {
                        refLabel = altText.toLowerCase().trim()
                    }

                    const ref = linkReferences.get(refLabel)
                    if (ref) {
                        addText(textStart, pos)
                        result.push({
                            type: "Image",
                            url: ref.url,
                            alt: altText,
                            title: ref.title,
                            children: [],
                        })
                        pos = refEnd
                        textStart = pos
                        continue
                    }
                }
            }
        }

        if (text[pos] === "[") {
            const linkEnd = text.indexOf("]", pos + 1)
            if (linkEnd !== -1) {
                const linkText = text.slice(pos + 1, linkEnd)

                if (linkEnd + 1 < text.length && text[linkEnd + 1] === "(") {
                    const linkInfo = parseLinkDestinationAndTitle(
                        text,
                        linkEnd + 1,
                    )
                    if (linkInfo) {
                        addText(textStart, pos)
                        const linkChildren =
                            linkText.trim() === ""
                                ? [
                                      {
                                          type: "Text",
                                          value: linkInfo.url,
                                      } as Inline,
                                  ]
                                : parseInline(linkText, linkReferences)
                        result.push({
                            type: "Link",
                            url: linkInfo.url,
                            title: linkInfo.title,
                            children: linkChildren,
                        })
                        pos = linkInfo.end
                        textStart = pos
                        continue
                    }
                }

                if (linkReferences) {
                    let refLabel = ""
                    let refEnd = linkEnd + 1

                    if (
                        linkEnd + 1 < text.length &&
                        text[linkEnd + 1] === "["
                    ) {
                        const refEndPos = text.indexOf("]", linkEnd + 2)
                        if (refEndPos !== -1) {
                            refLabel = text
                                .slice(linkEnd + 2, refEndPos)
                                .toLowerCase()
                                .trim()
                            if (refLabel === "") {
                                refLabel = linkText.toLowerCase().trim()
                            }
                            refEnd = refEndPos + 1
                        } else {
                            pos = linkEnd + 1
                            continue
                        }
                    } else {
                        refLabel = linkText.toLowerCase().trim()
                    }

                    const ref = linkReferences.get(refLabel)
                    if (ref) {
                        addText(textStart, pos)
                        const linkChildren =
                            linkText.trim() === ""
                                ? [{ type: "Text", value: ref.url } as Inline]
                                : parseInline(linkText, linkReferences)
                        result.push({
                            type: "Link",
                            url: ref.url,
                            title: ref.title,
                            children: linkChildren,
                        })
                        pos = refEnd
                        textStart = pos
                        continue
                    }
                }
            }
        }

        if (text[pos] === "*" || text[pos] === "_") {
            const type = text[pos] as "*" | "_"
            let length = 1
            while (pos + length < text.length && text[pos + length] === type) {
                length++
            }

            const canOpen = canBeOpener(pos, type)
            const canClose = canBeCloser(pos, type)

            if (canOpen || canClose) {
                addText(textStart, pos)
                const textNode: Inline = {
                    type: "Text",
                    value: type.repeat(length),
                }
                result.push(textNode)

                delimiterStack.push({
                    type,
                    length,
                    pos: result.length - 1,
                    canOpen,
                    canClose,
                    node: textNode,
                })

                textStart = pos + length
            }

            pos += length
            continue
        }

        pos++
    }

    addText(textStart, pos)

    processEmphasis(delimiterStack, result)

    return result
}

function processEmphasis(stack: Delimiter[], nodes: Inline[]) {
    let current = 0
    const openersBottom: Record<string, Record<string, number>> = {
        "*": { "0": -1, "1": -1, "2": -1 },
        _: { "0": -1, "1": -1, "2": -1 },
    }

    while (current < stack.length) {
        const closer = stack[current]
        if (!closer.canClose) {
            current++
            continue
        }

        let openerIndex = -1
        const bottom = openersBottom[closer.type][String(closer.length % 3)]

        for (let i = current - 1; i > bottom; i--) {
            const opener = stack[i]
            if (
                opener.type === closer.type &&
                opener.canOpen &&
                opener.length >= 2 === closer.length >= 2
            ) {
                openerIndex = i
                break
            }
        }

        if (openerIndex === -1) {
            if (!closer.canOpen) {
                stack.splice(current, 1)
            } else {
                openersBottom[closer.type][String(closer.length % 3)] =
                    current - 1
                current++
            }
            continue
        }

        const opener = stack[openerIndex]
        const emphasisLength = Math.min(opener.length, closer.length)
        const isStrong = emphasisLength >= 2

        const startIdx = opener.pos + 1
        const endIdx = closer.pos
        const children = nodes.slice(startIdx, endIdx)

        const emphasisNode: Inline = isStrong
            ? { type: "Strong", children }
            : { type: "Emphasis", children }

        const openerRemove = emphasisLength
        const closerRemove = emphasisLength

        let openerRemoved = false

        const openerNode = nodes[opener.pos]
        if (openerNode && openerNode.type === "Text") {
            const openerText = openerNode as any
            const remaining = openerText.value.slice(openerRemove)
            if (remaining.length > 0) {
                openerText.value = remaining
            } else {
                nodes.splice(opener.pos, 1)
                openerRemoved = true
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > opener.pos) stack[j].pos--
                }
                if (closer.pos > opener.pos) closer.pos--
            }
        }

        const closerNode = nodes[closer.pos]
        if (closerNode && closerNode.type === "Text") {
            const closerText = closerNode as any
            const remaining = closerText.value.slice(closerRemove)
            if (remaining.length > 0) {
                closerText.value = remaining
            } else {
                nodes.splice(closer.pos, 1)
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > closer.pos) stack[j].pos--
                }
            }
        }

        let insertPos = opener.pos
        if (!openerRemoved) {
            insertPos = opener.pos + 1
        }

        const childrenCount = children.length
        nodes.splice(insertPos, childrenCount, emphasisNode)

        const netChange = 1 - childrenCount
        for (let j = 0; j < stack.length; j++) {
            if (stack[j].pos >= insertPos + childrenCount) {
                stack[j].pos += netChange
            } else if (
                stack[j].pos > insertPos &&
                stack[j].pos < insertPos + childrenCount
            ) {
            }
        }

        stack.splice(openerIndex, current - openerIndex + 1)

        current = 0
    }
}

function renderInline(inline: Inline): string {
    switch (inline.type) {
        case "Text":
            return escape(inline.value)
        case "Emphasis":
            return `<em>${inline.children.map(renderInline).join("")}</em>`
        case "Strong":
            return `<strong>${inline.children.map(renderInline).join("")}</strong>`
        case "CodeSpan":
            return `<code>${escape(inline.value)}</code>`
        case "Link":
            const linkTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<a href="${escape(inline.url)}"${linkTitle}>${inline.children.map(renderInline).join("")}</a>`
        case "Image":
            const imgTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<img src="${escape(inline.url)}" alt="${escape(inline.alt)}"${imgTitle} />`
        case "Autolink":
            return `<a href="${escape(inline.url)}">${escape(inline.url)}</a>`
        case "HTML":
            return inline.html
        case "SoftBreak":
            return " "
        case "HardBreak":
            return "<br />"
    }
}

export {
    tryOpenBlock,
    tryOpenBlockQuote,
    tryOpenHeading,
    tryOpenParagraph,
    tryOpenThematicBreak,
    closeBlock,
    isContainerBlock,
    wouldOpenBlock,
    renderBlock,
    renderInline,
    parseBlock,
    parseInline,
}
