import type { AstApplyEffect, Block, DetectedBlock, Inline, TableCell, TableHeader, List, ListItem, TaskListItem, BlockQuote, CodeBlock } from '../../../types'
import type { AstContext } from '../astContext'
import { strip } from '../../../utils/utils'

class AstTransform {
    constructor(private ctx: AstContext) {}

    transformBlock(
        text: string,
        block: Block,
        detected: DetectedBlock,
        caretPosition: number | null = null,
        removedBlocks: Block[] = []
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        if (caretPosition != null) {
            const removedBefore = (text.slice(0, caretPosition).match(/[\u200B\u200C\u200D\uFEFF]/g) || []).length
            caretPosition = Math.max(0, caretPosition - removedBefore)
        }
        text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/\r$/, '')

        if (detected.type === 'codeBlock') return this.toCodeBlock(text, block, caretPosition, removedBlocks)

        const flat = query.flattenBlocks(ast.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

        // disabled
        // if (
        //     block.type === 'paragraph' &&
        //     entry.parent &&
        //     (entry.parent.type === 'listItem' || entry.parent.type === 'taskListItem')
        // ) {
        //     const parent = entry.parent as ListItem | TaskListItem
        //     const marker = parent.inlines?.find((i: Inline) => i.type === 'marker')?.text.symbolic ?? ''

        //     if (/^(\s*[-*+]\s+|\s*\d+[.)]\s+)$/.test(marker)) {
        //         const m = /^\[([ xX])\](?:\s+|$)/.exec(text)
        //         if (m) {
        //             const checked = m[1].toLowerCase() === 'x'
        //             ;(parent as any).type = 'taskListItem'
        //             ;(parent as any).checked = checked
        //             text = text.slice(m[0].length)
        //         } else if (parent.type === 'taskListItem') {
        //             ;(parent as any).type = 'listItem'
        //             delete (parent as any).checked
        //         }
        //     }
        // }

        const newBlocks = parser.reparseTextFragment(text, block.position.start)
        const inline = query.getFirstInline(newBlocks)
        if (!inline) return null

        if (entry.parent && (entry.parent.type === 'tableCell' || entry.parent.type === 'tableHeader')) {
            const cell = entry.parent as TableCell | TableHeader
            cell.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: cell, current: cell }])],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
                effect.dom('structure')
            )
        }

        const isListItemBlock = block.type === 'listItem' || block.type === 'taskListItem'
        const isListItemDetected = detected.type === 'listItem' || detected.type === 'taskListItem'

        if (isListItemDetected) {
            return this.toListItem(text, block, caretPosition)
        }

        if (entry.parent && entry.parent.type === 'list' && isListItemBlock && !isListItemDetected) {
            const list = entry.parent as List
            const listEntry = flat.find(b => b.block.id === list.id)

            if (!listEntry) return null

            if (list.blocks.length > 1) {
                list.blocks.splice(entry.index, 1)
                ast.blocks.splice(listEntry.index, 0, ...newBlocks)

                return effect.compose(
                    [effect.update([{ type: 'block', at: 'previous', target: list, current: newBlocks[0] }], [entry.block])],
                    effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
                    effect.dom('structure')
                )
            }

            ast.blocks.splice(listEntry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: list, current: newBlocks[0] }])],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
                effect.dom('structure')
            )
        }

        if (entry.parent && 'blocks' in entry.parent && Array.isArray((entry.parent as any).blocks)) {
            const parent = entry.parent as any
            parent.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                [effect.update([{ type: 'block', at: 'current', target: parent, current: parent }], removedBlocks)],
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
                effect.dom('structure')
            )
        }

        const oldBlock = block
        ast.blocks.splice(entry.index, 1, ...newBlocks)

        return effect.compose(
            [effect.update([{ type: 'block', at: 'current', target: oldBlock, current: newBlocks[0] }], removedBlocks)],
            effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
            effect.dom('structure')
        )
    }

    toCodeBlock(
        text: string,
        block: Block,
        _caretPosition: number | null = null,
        preRemoved: Block[] = []
    ): AstApplyEffect | null {
        const { ast, parser, effect } = this.ctx

        const entryIndex = ast.blocks.findIndex(b => b.id === block.id)
        if (entryIndex === -1) return null

        const firstLine = (text.split('\n')[0] ?? text)
        const isIndented =
            /^ {4,}[^ ]/.test(firstLine) &&
            !/^\s{0,3}(```+|~~~+)/.test(firstLine)

        if (isIndented) {
            const newBlocks = parser.reparseTextFragment(text, block.position.start)
            if (newBlocks.length === 0) return null

            const oldBlock = block
            ast.blocks.splice(entryIndex, 1, ...newBlocks)

            const first = newBlocks[0]
            const body = first.inlines.find(i => i.type === 'text') ?? first.inlines[0]
            if (!body) return null

            const preferred = _caretPosition ?? 0
            let caretTarget = body
            let caretPos = Math.min(Math.max(0, preferred), body.text.symbolic.length)
            if (first.type === 'codeBlock' && !(first as CodeBlock).isFenced) {
                const marker = first.inlines.find(i => i.type === 'marker')
                if (marker && preferred >= marker.text.symbolic.length) {
                    caretPos = Math.min(
                        preferred - marker.text.symbolic.length,
                        body.text.symbolic.length
                    )
                } else if (marker && preferred < marker.text.symbolic.length) {
                    caretTarget = body
                    caretPos = 0
                }
            }

            const inserts = newBlocks.map((b, idx) => ({
                type: 'block' as const,
                at: (idx === 0 ? 'current' : 'next') as 'current' | 'next',
                target: idx === 0 ? oldBlock : newBlocks[idx - 1],
                current: b,
            }))

            return effect.compose(
                [effect.update(inserts, preRemoved.length > 0 ? [...preRemoved, oldBlock] : [oldBlock])],
                effect.caret(caretTarget.blockId, caretTarget.id, caretPos, 'start'),
                effect.dom('structure')
            )
        }

        let nextCodeBlockIndex = -1
        let nextCodeBlock: CodeBlock | null = null
        for (let i = entryIndex + 1; i < ast.blocks.length; i++) {
            if (ast.blocks[i].type === 'codeBlock') {
                nextCodeBlockIndex = i
                nextCodeBlock = ast.blocks[i] as CodeBlock
                break
            }
        }

        const absorbEnd = nextCodeBlockIndex === -1 ? ast.blocks.length : nextCodeBlockIndex
        const absorbedBlocks = ast.blocks.slice(entryIndex + 1, absorbEnd)

        let newText = text
        if (absorbedBlocks.length > 0) {
            for (const b of absorbedBlocks) {
                const piece = String(b.text ?? '').replace(/^\u200B$/, '')
                newText += '\n' + piece
            }
        } else if (preRemoved.length === 0) {
            const sliceTo = nextCodeBlock ? nextCodeBlock.position.start : ast.text.length
            const after = ast.text.slice(block.position.end, sliceTo)
            if (after.length > 0) newText = text + after
        }

        let removeCount = absorbedBlocks.length + 1
        const renderRemove = [...preRemoved, ...absorbedBlocks]

        if (nextCodeBlock && !nextCodeBlock.close) {
            newText += '\n' + (nextCodeBlock.fenceChar?.repeat(nextCodeBlock.fenceLength ?? 3) ?? '```')
            renderRemove.push(nextCodeBlock)
            removeCount += 1
        }

        const newBlocks = parser.reparseTextFragment(newText, block.position.start)
        if (newBlocks.length === 0) return null

        const oldBlock = block
        ast.blocks.splice(entryIndex, removeCount, ...newBlocks)

        const first = newBlocks[0]
        const opener = first.inlines.find(i => i.type === 'marker')
        const body = first.inlines.find(i => i.type === 'text')
        if (!body && !opener && first.inlines.length === 0) return null

        const preferred = _caretPosition
        let caretTarget = body ?? opener ?? first.inlines[0]
        let caretPos = 0

        if (preferred != null && first.type === 'codeBlock') {
            let offset = 0
            for (const inline of first.inlines) {
                const len = inline.text.symbolic.length
                if (preferred <= offset + len) {
                    caretTarget = inline
                    caretPos = Math.max(0, preferred - offset)
                    break
                }
                offset += len
                caretTarget = inline
                caretPos = len
            }
            if (caretTarget.type === 'marker' && body && caretTarget === opener) {
                caretTarget = body
                caretPos = 0
            }
        } else if (body) {
            caretTarget = body
            caretPos = 0
        }

        const inserts = newBlocks.map((b, idx) => ({
            type: 'block' as const,
            at: (idx === 0 ? 'current' : 'next') as 'current' | 'next',
            target: idx === 0 ? oldBlock : newBlocks[idx - 1],
            current: b,
        }))

        return effect.compose(
            [effect.update(inserts, renderRemove)],
            effect.caret(caretTarget.blockId, caretTarget.id, caretPos, 'start'),
            effect.dom('structure')
        )
    }

    toListItem(text: string, block: Block, caretPosition: number | null = null): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        text = strip(text)

        const blocks = query.flattenBlocks(ast.blocks)
        const entry = blocks.find(b => b.block.id === block.id)
        if (!entry) return null

        const newBlocks = parser.reparseTextFragment(text, block.position.start)
        const inline = query.getFirstInline(newBlocks)
        if (!inline) return null

        const oldBlock = block
        ast.blocks.splice(entry.index, 1, ...newBlocks)

        return effect.compose(
            [effect.update([{ type: 'block', at: 'current', target: oldBlock, current: newBlocks[0] }])],
            effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start'),
            effect.dom('structure')
        )
    }
}

export default AstTransform
