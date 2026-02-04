import type { AstApplyEffect, Block, DetectedBlock, Inline, TableCell, TableHeader, List, ListItem, TaskListItem, BlockQuote, CodeBlock } from '../../../types'
import type { AstContext } from '../astContext'

class AstTransform {
    constructor(private ctx: AstContext) {}

    private resolveCaret(inline: Inline, caretPosition: number | null) {
        if (caretPosition == null) {
            return { blockId: inline.blockId, inlineId: inline.id, pos: 0 }
        }

        const local = caretPosition - (inline.position?.start ?? 0)
        const pos = Math.max(0, Math.min(local, inline.text.symbolic.length))

        return { blockId: inline.blockId, inlineId: inline.id, pos: pos }
    }

    transformBlock(
        text: string,
        block: Block,
        detected: DetectedBlock,
        caretPosition: number | null = null,
        removedBlocks: Block[] = []
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        text = text.replace(/[\u00A0\u200C\u200D\uFEFF]/g, '').replace(/\r$/, '')

        if (detected.type === 'codeBlock') return this.toCodeBlock(text, block, caretPosition)

        const flat = query.flattenBlocks(ast.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

        if (
            block.type === 'paragraph' &&
            entry.parent &&
            (entry.parent.type === 'listItem' || entry.parent.type === 'taskListItem')
        ) {
            const parent = entry.parent as ListItem | TaskListItem
            const marker = parent.inlines?.find((i: Inline) => i.type === 'marker')?.text.symbolic ?? ''

            if (/^(\s*[-*+]\s+|\s*\d+[.)]\s+)$/.test(marker)) {
                const m = /^\[([ xX])\](?:\s+|$)/.exec(text)
                if (m) {
                    const checked = m[1].toLowerCase() === 'x'
                    ;(parent as any).type = 'taskListItem'
                    ;(parent as any).checked = checked
                    text = text.slice(m[0].length)
                } else if (parent.type === 'taskListItem') {
                    ;(parent as any).type = 'listItem'
                    delete (parent as any).checked
                }
            }
        }

        const newBlocks = parser.reparseTextFragment(text, block.position.start)
        const inline = query.getFirstInline(newBlocks)
        if (!inline) return null

        if (entry.parent && (entry.parent.type === 'tableCell' || entry.parent.type === 'tableHeader')) {
            const cell = entry.parent as TableCell | TableHeader
            cell.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: cell, current: cell }])],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        const isListItemBlock = block.type === 'listItem' || block.type === 'taskListItem'
        const isListItemDetected = detected.type === 'listItem' || detected.type === 'taskListItem'

        if (entry.parent && entry.parent.type === 'list' && isListItemBlock && !isListItemDetected) {
            const list = entry.parent as List
            const listEntry = flat.find(b => b.block.id === list.id)
            if (!listEntry) return null

            if (list.blocks.length > 1) {
                list.blocks.splice(entry.index, 1)
                ast.blocks.splice(listEntry.index, 0, ...newBlocks)

                return effect.compose(
                    [effect.update([{ type: 'block', at: 'previous', target: list, current: newBlocks[0] }], [entry.block])],
                    effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
                )
            }

            ast.blocks.splice(listEntry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: list, current: newBlocks[0] }])],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        if (entry.parent && 'blocks' in entry.parent && Array.isArray((entry.parent as any).blocks)) {
            const parent = entry.parent as any
            parent.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: parent, current: parent }], removedBlocks)],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        const oldBlock = block
        ast.blocks.splice(entry.index, 1, ...newBlocks)

        return effect.compose(
            [effect.update([{ type: 'block', at: 'current', target: oldBlock, current: newBlocks[0] }], removedBlocks)],
            effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
        )
    }

    toCodeBlock(text: string, block: Block, caretPosition: number | null = null): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        const blocks = query.flattenBlocks(ast.blocks)
        const entry = blocks.find(b => b.block.id === block.id)
        if (!entry) return null
    
        let firstCodeBlock: CodeBlock | null = null
        const firstCodeBlockEntry = blocks.find(b => b.index >= entry.index && b.block.type === 'codeBlock')
        if (firstCodeBlockEntry) {
            firstCodeBlock = firstCodeBlockEntry.block as CodeBlock
        }

        console.log('firstCodeBlockEntry', JSON.stringify(firstCodeBlockEntry, null, 2))
        // return null
        const removedBlocks = blocks.slice(entry.index + 1, firstCodeBlockEntry ? firstCodeBlockEntry.index : ast.blocks.length).map(b => b.block)
        const sliceTo = firstCodeBlockEntry ? firstCodeBlockEntry.block.position.start + 1 : this.ctx.ast.text.length
        let newText = text + ast.text.slice(block.position.start + (caretPosition ?? 0), sliceTo)

        if (firstCodeBlock && !firstCodeBlock.close) {
            newText += '\n' + firstCodeBlock.fenceChar?.repeat(firstCodeBlock.fenceLength ?? 3)
            removedBlocks.push(firstCodeBlock as Block)
        }

        const newBlocks = parser.reparseTextFragment(newText, block.position.start)
        console.log('newBlocks', JSON.stringify(newBlocks, null, 2))
        console.log('newText', JSON.stringify(newText, null, 2))
        if (newBlocks.length === 0) return null

        // console.log('newBlocks', JSON.stringify(newBlocks, null, 2))
        console.log('text', JSON.stringify(text, null, 2))
        console.log('slice', JSON.stringify(ast.text.slice(block.position.end + (caretPosition ?? 0), sliceTo), null, 2))
        // console.log('newText', JSON.stringify(newText, null, 2))
        // console.log('removedBlocks', JSON.stringify(removedBlocks, null, 2))
        // return null

        const oldBlock = block
        ast.blocks.splice(entry.index, removedBlocks.length, ...newBlocks)

        return effect.compose(
            [effect.update([{ type: 'block', at: 'current', target: oldBlock, current: newBlocks[0] }], removedBlocks)],
            effect.caret(newBlocks[0].id, newBlocks[0].inlines[0].id, newBlocks[0].inlines[0].position.end, 'start')
        )
    }
}

export default AstTransform
