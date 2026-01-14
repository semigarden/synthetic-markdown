import type Ast from '../ast/ast'
import type Caret from '../caret'
import type { EditContext, SelectionPoint, SelectionRange } from '../../types'

function mapSemanticOffsetToSymbolic(
    semanticLength: number,
    symbolicLength: number,
    semanticOffset: number
) {
    if (semanticOffset === 0) return 0

    let ratio = symbolicLength / semanticLength
    ratio = Math.max(0.5, Math.min(2.0, ratio))
    const offset = Math.round(semanticOffset * ratio)

    return Math.max(0, Math.min(offset, symbolicLength))
}

function resolvePoint(
    ast: Ast,
    node: Node,
    offset: number
): SelectionPoint | null {
    const el = node instanceof HTMLElement ? node : node.parentElement
    if (!el) return null

    const inlineEl = el.closest('[data-inline-id]') as HTMLElement | null
    if (!inlineEl) return null

    const inlineId = inlineEl.dataset.inlineId!
    const inline = ast.query.getInlineById(inlineId)
    if (!inline) return null

    let localOffset = offset
    if (inlineEl.contains(node) && node !== inlineEl) {
        const preRange = document.createRange()
        preRange.selectNodeContents(inlineEl)
        preRange.setEnd(node, offset)
        localOffset = preRange.toString().length
    }

    return {
        blockId: inline.blockId,
        inlineId,
        position: localOffset,
    }
}

function comparePoints(ast: Ast, a: SelectionPoint, b: SelectionPoint): number {
    if (a.blockId !== b.blockId) {
        const flatBlocks = ast.query.flattenBlocks(ast.blocks)
        const aEntry = flatBlocks.find(entry => entry.block.id === a.blockId)
        const bEntry = flatBlocks.find(entry => entry.block.id === b.blockId)
        if (!aEntry || !bEntry) return 0
        return aEntry.index - bEntry.index
    }

    if (a.inlineId !== b.inlineId) {
        const flatInlines = ast.query.flattenInlines(ast.blocks)
        const aEntry = flatInlines.find(entry => entry.inline.id === a.inlineId)
        const bEntry = flatInlines.find(entry => entry.inline.id === b.inlineId)
        if (!aEntry || !bEntry) return 0
        return aEntry.index - bEntry.index
    }

    return a.position - b.position
}

function resolveRangeFromSelection(
    ast: Ast,
    caret: Caret,
    selection: globalThis.Selection
): SelectionRange | null {
    const range = selection.rangeCount ? selection.getRangeAt(0) : null
    if (!range) {
        caret.clear()
        return null
    }

    const anchor = resolvePoint(ast, selection.anchorNode!, selection.anchorOffset)
    const focus = resolvePoint(ast, selection.focusNode!, selection.focusOffset)

    if (!anchor || !focus) {
        caret.clear()
        return null
    }

    const comparison = comparePoints(ast, anchor, focus)
    const direction = comparison <= 0 ? 'forward' : 'backward'

    const ordered = comparison <= 0 ? { start: anchor, end: focus } : { start: focus, end: anchor }

    const resolved: SelectionRange = { ...ordered, direction }

    const isSamePoint =
        ordered.start.blockId === ordered.end.blockId &&
        ordered.start.inlineId === ordered.end.inlineId &&
        ordered.start.position === ordered.end.position

    if (isSamePoint) {
        caret.blockId = ordered.start.blockId
        caret.inlineId = ordered.start.inlineId
        caret.position = ordered.start.position
        caret.affinity = direction === 'forward' ? 'end' : 'start'
    } else {
        caret.clear()
    }

    return resolved
}

function resolveRange(ast: Ast): SelectionRange | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null

    const domRange = sel.getRangeAt(0)

    const start = resolvePoint(ast, domRange.startContainer, domRange.startOffset)
    const end = resolvePoint(ast, domRange.endContainer, domRange.endOffset)
    if (!start || !end) return null

    const direction =
        sel.anchorNode === domRange.startContainer && sel.anchorOffset === domRange.startOffset
            ? 'forward'
            : 'backward'

    if (comparePoints(ast, start, end) > 0) {
        return { start: end, end: start, direction }
    }

    return { start, end, direction }
}

function resolveInlineContext(
    ast: Ast,
    caret: Caret,
    rootElement: HTMLElement
): EditContext | null {
    const blockId = caret.blockId
    const inlineId = caret.inlineId
    if (!blockId || !inlineId) return null

    const block = ast.query.getBlockById(blockId)
    if (!block) return null

    const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
    if (inlineIndex === -1) return null

    const inline = block.inlines[inlineIndex]

    const inlineElement = rootElement.querySelector(
        `[data-inline-id="${inlineId}"]`
    ) as HTMLElement | null
    if (!inlineElement) return null

    return { block, inline, inlineIndex, inlineElement }
}

export { mapSemanticOffsetToSymbolic, resolvePoint, comparePoints, resolveRangeFromSelection, resolveRange, resolveInlineContext }
