import { Block, Inline, CodeBlock } from "../../types"
import { parseInlineContent, extractFencedCodeContent } from '../../ast/ast'
import { uuid } from "../../utils/utils"

class ParseInline {
    public apply(block: Block): Inline[] {
        const inlines: Inline[] = []
        const text = block.text ?? ''
        const blockId = block.id

        if (text === '') {
            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 },
            })
            return inlines
        }

        if (block.type === 'codeBlock') {
            const codeBlock = block as CodeBlock
            const semantic = codeBlock.isFenced
                ? extractFencedCodeContent(text, codeBlock.fence!)
                : text

            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: {
                    symbolic: text,
                    semantic,
                },
                position: {
                    start: 0,
                    end: text.length,
                },
            })

            return inlines
        }

        let parseText = text
        let textOffset = 0

        if (block.type === 'heading') {
            const match = text.match(/^(#{1,6})\s+/)
            if (match) {
                textOffset = match[0].length
                parseText = text.slice(textOffset)
            }
        }

        const newInlines = parseInlineContent(
            parseText,
            blockId,
            textOffset
        )

        for (const inline of newInlines) {
            inlines.push({
                ...inline,
                id: uuid(),
                blockId,
            })
        }

        return inlines
    }

    public applyRecursive(block: Block) {
        switch (block.type) {
            case 'paragraph':
            case 'heading':
            case 'codeBlock': {
                block.inlines = this.apply(block)
                return
            }

            default:
                if ('blocks' in block && Array.isArray(block.blocks)) {
                    for (const child of block.blocks) {
                        this.applyRecursive(child)
                    }
                }
        }
    }
}

export default ParseInline
