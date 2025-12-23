import { isContainerBlock } from "../context/BlockContext"
import { parseInline } from "../parseInline"
import type { BlockContext } from "../../types"
import type { LineState } from "../context/LineState"
import type { Heading } from "../../types/block"
import type { DocumentWithRefs } from "../../types"

function tryOpenHeading(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    let count = 0

    while (line.peek() === "#" && count < 6) {
        line.advance(1)
        count++
    }

    if (count === 0) return null
    if (line.peek() !== " " && line.peek() !== "") return null

    if (line.peek() === " ") line.advance(1)

    const originalLine = line.text
    const node: Heading = {
        type: "heading",
        level: count,
        children: [],
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    let rawText = originalLine

    return {
        type: "heading",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue() {
            return false
        },
        addLine(_text, originalLine) {
            rawText += (rawText ? "\n" : "") + originalLine
        },
        finalize(endIndex) {
            let doc: BlockContext | null = parent
            while (doc && doc.type !== "document") {
                doc = doc.parent
            }
            const linkRefs = doc?.node
                ? ((doc.node as unknown as DocumentWithRefs).__linkReferences)
                : undefined
            node.children = parseInline(rawText.trim(), linkRefs, node.startIndex)
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
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

export { tryOpenHeading, tryOpenSetextHeading }
