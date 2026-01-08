import { Block, Inline, TableRow } from "../../types"
import { uuid } from "../../utils/utils"

class AstNormalizer {
    public text = ''

    public apply(blocks: Block[]) {
        let globalPos = 0

        const updateBlock = (block: Block): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
                let localPos = 0

                for (const inline of block.inlines) {
                    if (!inline.id) inline.id = uuid()
                        const len = inline.text.symbolic.length
                        inline.position = {
                        start: localPos,
                        end: localPos + len,
                    }
                    localPos += len
                }

                text = block.inlines.map((i: Inline) => i.text.symbolic).join('')
                block.text = text
                block.position = { start, end: start + text.length }
                globalPos += text.length

                return text
            }

            if (block.type === 'blockQuote') {
                const parts: string[] = []
            
                for (let i = 0; i < block.blocks.length; i++) {
                    const child = block.blocks[i]
            
                    const childText = updateBlock(child)
            
                    parts.push('> ' + childText)
            
                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }
            
                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
            
                return text
            }

            if (block.type === 'table') {
                const parts: string[] = []
            
                block.blocks.forEach((row, rowIndex) => {
                    const rowText = updateBlock(row)
                    parts.push(rowText)
            
                    if (rowIndex === 0) {
                        parts.push('\n')
                        globalPos += 1
            
                        const divider = (row as TableRow).blocks
                            .map(() => '---')
                            .join(' | ')
            
                        const dividerLine = `| ${divider} |`
                        parts.push(dividerLine)
                        globalPos += dividerLine.length
                    }
            
                    if (rowIndex < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                })
            
                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'tableRow') {
                const parts: string[] = []
            
                parts.push('| ')
                globalPos += 2
            
                block.blocks.forEach((cell, i) => {
                    const cellText = updateBlock(cell)
                    parts.push(cellText)
            
                    if (i < block.blocks.length - 1) {
                        parts.push(' | ')
                        globalPos += 3
                    }
                })
            
                parts.push(' |')
                globalPos += 2
            
                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'tableCell') {
                const paragraph = block.blocks[0]
                const cellText = updateBlock(paragraph)
            
                block.text = cellText
                block.position = { start, end: globalPos }
            
                return cellText
            }

            if (block.type === 'list') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const item = block.blocks[i]
                    const itemText = updateBlock(item)
                    parts.push(itemText)

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
            }

            if (block.type === 'listItem') {
                const marker = '- '
                text += marker
                globalPos += marker.length

                const content = updateBlock(block.blocks[0])
                text += content
            }

            block.text = text
            block.position = { start, end: globalPos }

            return text
        }

        const parts: string[] = []
        for (let i = 0; i < blocks.length; i++) {
            parts.push(updateBlock(blocks[i]))
            if (i < blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        this.text = parts.join('')
    }
}

export default AstNormalizer
