import AST from './ast/ast'
import Caret from './caret'
import { EditContext, SelectionRange, SelectionPoint, Inline, Block } from '../types'

class Selection {
    private rafId: number | null = null
    private focusedBlockId: string | null = null
    private focusedInlineId: string | null = null
    private range: SelectionRange | null = null 
    private suppressSelectionChange: boolean = false

    constructor(
        private ast: AST,
        private caret: Caret,
        private rootElement: HTMLElement,
    ) {}

    attach() {
        document.addEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.addEventListener('focusin', this.onRootFocusIn)
        this.rootElement.addEventListener('focusout', this.onRootFocusOut)
    }

    detach() {
        document.removeEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.removeEventListener('focusin', this.onRootFocusIn)
        this.rootElement.removeEventListener('focusout', this.onRootFocusOut)
    }

    private onSelectionChange = () => {
        if (this.suppressSelectionChange) return
    
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
        }
    
        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                this.range = null
                this.caret.clear()
                return
            }
    
            const range = selection.getRangeAt(0)
            const isCollapsed = range.collapsed

            if (isCollapsed) {
                const currentInlineEl = this.getInlineElementFromNode(range.startContainer)
                const currentInlineId = currentInlineEl?.dataset?.inlineId ?? null
                
                if (currentInlineId !== this.focusedInlineId) {
                    this.handleInlineTransition(currentInlineId, selection, range)
                }
            }
            
            this.resolveRangeFromSelection(selection, range)
        })
    }

    private onRootFocusIn = (e: FocusEvent) => {
    }

    private onRootFocusOut = (e: FocusEvent) => {
        if (!this.rootElement.contains(e.relatedTarget as Node)) {
            this.unfocusCurrentInline()
            this.caret.clear()
            this.focusedInlineId = null
            this.focusedBlockId = null
        }
    }

    private getInlineElementFromNode(node: Node): HTMLElement | null {
        const el = node instanceof HTMLElement ? node : node.parentElement
        if (!el) return null
        return el.closest('[data-inline-id]') as HTMLElement | null
    }

    private handleInlineTransition(
        newInlineId: string | null,
        selection: globalThis.Selection,
        range: Range
    ) {
        if (this.focusedInlineId) {
            this.unfocusInline(this.focusedInlineId)
        }

        if (newInlineId) {
            this.focusInline(newInlineId, selection, range)
        }

        this.focusedInlineId = newInlineId
    }

    private focusInline(inlineId: string, selection: globalThis.Selection, range: Range) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return

        const inlineEl = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineEl) return

        if (block.id !== this.focusedBlockId) {
            const marker = block.inlines.find(i => i.type === 'marker')
            if (marker && marker.text.symbolic.length > 0) {
                const markerEl = this.rootElement.querySelector(
                    `[data-inline-id="${marker.id}"]`
                ) as HTMLElement | null
                if (markerEl) {
                    markerEl.textContent = marker.text.symbolic
                }
            }
            this.focusedBlockId = block.id
        }

        let localOffset = 0
        if (inlineEl.contains(range.startContainer)) {
            const preRange = document.createRange()
            preRange.selectNodeContents(inlineEl)
            preRange.setEnd(range.startContainer, range.startOffset)
            localOffset = preRange.toString().length
        }

        const symbolicOffset = this.mapSemanticOffsetToSymbolic(
            inline.text.semantic.length,
            inline.text.symbolic.length,
            localOffset
        )

        this.suppressSelectionChange = true
        inlineEl.textContent = inline.text.symbolic

        const textNode = inlineEl.firstChild
        if (textNode instanceof Text) {
            const clampedOffset = Math.max(0, Math.min(symbolicOffset, textNode.length))
            const newRange = document.createRange()
            newRange.setStart(textNode, clampedOffset)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        requestAnimationFrame(() => {
            this.suppressSelectionChange = false
        })
    }

    private unfocusInline(inlineId: string) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const inlineEl = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineEl) return

        if (inline.type === 'image') {
            const imageElement = document.createElement('img')
            imageElement.id = inline.id
            imageElement.dataset.inlineId = inline.id
            imageElement.classList.add('inline', 'image')
            ;(imageElement as HTMLImageElement).src = (inline as any).url || ''
            ;(imageElement as HTMLImageElement).alt = (inline as any).alt || ''
            ;(imageElement as HTMLImageElement).title = (inline as any).title || ''
            inlineEl.replaceWith(imageElement)
        } else {
            inlineEl.textContent = inline.text.semantic
        }

        const block = this.ast.query.getBlockById(inline.blockId)
        if (block && block.id === this.focusedBlockId) {
            const marker = block.inlines.find(i => i.type === 'marker')
            if (marker && marker.text.symbolic.length) {
                const markerEl = this.rootElement.querySelector(
                    `[data-inline-id="${marker.id}"]`
                ) as HTMLElement | null
                if (markerEl && marker.id !== inlineId) {
                    markerEl.textContent = marker.text.semantic
                }

                if (block.type === 'thematicBreak') {
                    const blockEl = this.rootElement.querySelector(
                        `[data-block-id="${block.id}"]`
                    ) as HTMLElement | null
                    if (blockEl) {
                        const hrEl = document.createElement('hr')
                        hrEl.classList.add('block', 'thematicBreak')
                        hrEl.id = block.id
                        hrEl.dataset.blockId = block.id
                        blockEl.replaceWith(hrEl)
                    }
                }
            }
            this.focusedBlockId = null
        }
    }

    private unfocusCurrentInline() {
        if (this.focusedInlineId) {
            this.unfocusInline(this.focusedInlineId)
        }
    }

    private resolvePoint(node: Node, offset: number): SelectionPoint | null {
        const el = node instanceof HTMLElement ? node : node.parentElement
        if (!el) return null
    
        const inlineEl = el.closest('[data-inline-id]') as HTMLElement
        if (!inlineEl) return null
    
        const inlineId = inlineEl.dataset.inlineId!
        const inline = this.ast.query.getInlineById(inlineId)
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
            position: localOffset
        }
    }

    public resolveRange(): SelectionRange | null {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
    
        const domRange = sel.getRangeAt(0)
    
        const start = this.resolvePoint(
            domRange.startContainer,
            domRange.startOffset,
        )
    
        const end = this.resolvePoint(
            domRange.endContainer,
            domRange.endOffset,
        )
    
        if (!start || !end) return null
    
        const direction = sel.anchorNode === domRange.startContainer &&
                          sel.anchorOffset === domRange.startOffset
            ? 'forward'
            : 'backward'
    
        if (this.comparePoints(start, end) > 0) {
            return { start: end, end: start, direction }
        }
    
        return { start, end, direction }
    }
    
    private comparePoints(a: SelectionPoint, b: SelectionPoint): number {
        if (a.blockId !== b.blockId) {
            const flatBlocks = this.ast.query.flattenBlocks(this.ast.blocks)
            const aEntry = flatBlocks.find(entry => entry.block.id === a.blockId)
            const bEntry = flatBlocks.find(entry => entry.block.id === b.blockId)
            if (!aEntry || !bEntry) return 0
            return aEntry.index - bEntry.index
        }
    
        if (a.inlineId !== b.inlineId) {
            const flatInlines = this.ast.query.flattenInlines(this.ast.blocks)
            const aEntry = flatInlines.find(entry => entry.inline.id === a.inlineId)
            const bEntry = flatInlines.find(entry => entry.inline.id === b.inlineId)
            if (!aEntry || !bEntry) return 0
            return aEntry.index - bEntry.index
        }
    
        return a.position - b.position
    }    

    private resolveRangeFromSelection(selection: globalThis.Selection, range: Range) {
        const anchor = this.resolvePoint(
            selection.anchorNode!,
            selection.anchorOffset,
        )
    
        const focus = this.resolvePoint(
            selection.focusNode!,
            selection.focusOffset,
        )
    
        if (!anchor || !focus) {
            this.range = null
            this.caret.clear()
            return
        }
    
        const comparison = this.comparePoints(anchor, focus)
        const direction = comparison <= 0 ? 'forward' : 'backward'
    
        const ordered = comparison <= 0
            ? { start: anchor, end: focus }
            : { start: focus, end: anchor }
    
        this.range = {
            ...ordered,
            direction
        }
    
        const isSamePoint = 
            ordered.start.blockId === ordered.end.blockId &&
            ordered.start.inlineId === ordered.end.inlineId &&
            ordered.start.position === ordered.end.position

        if (isSamePoint) {
            this.caret.blockId = ordered.start.blockId
            this.caret.inlineId = ordered.start.inlineId
            this.caret.position = ordered.start.position
            this.caret.affinity = direction === 'forward' ? 'end' : 'start'
        } else {
            this.caret.clear()
        }
    }

    public resolveInlineContext(): EditContext | null {
        const blockId = this.caret.blockId
        const inlineId = this.caret.inlineId

        if (!blockId || !inlineId) return null
    
        const block = this.ast.query.getBlockById(blockId)
        if (!block) return null
    
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        const inline = block.inlines[inlineIndex]
    
        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
    
        if (!inlineElement) return null
    
        return {
            block,
            inline,
            inlineIndex,
            inlineElement
        }
    }

    private mapSemanticOffsetToSymbolic(
        semanticLength: number,
        symbolicLength: number,
        semanticOffset: number
    ) {
        if (semanticOffset === 0) return 0

        let ratio = symbolicLength / semanticLength
        ratio = Math.max(0.5, Math.min(2.0, ratio))
        let offset = Math.round(semanticOffset * ratio)

        return Math.max(0, Math.min(offset, symbolicLength))
    }

    private findClosestInlineAndPosition(block: Block, clickX: number, clickY: number): { inline: Inline; position: number } | null {
        const blockElement = this.rootElement?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement
        if (!blockElement) return null

        const inlineElements = Array.from(blockElement.querySelectorAll('[data-inline-id]')) as HTMLElement[]
        if (inlineElements.length === 0) return null

        let closestInline: HTMLElement | null = null
        let minDistance = Infinity
        let horizontallyAlignedInline: HTMLElement | null = null
        let minVerticalDistance = Infinity

        for (const inlineEl of inlineElements) {
            const rect = inlineEl.getBoundingClientRect()
            
            const isHorizontallyAligned = clickX >= rect.left && clickX <= rect.right
            
            if (isHorizontallyAligned) {
                const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
                if (verticalDistance < minVerticalDistance) {
                    minVerticalDistance = verticalDistance
                    horizontallyAlignedInline = inlineEl
                }
            } else {
                const horizontalDistance = Math.min(Math.abs(clickX - rect.left), Math.abs(clickX - rect.right))
                const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
                const distance = horizontalDistance + verticalDistance
                
                if (distance < minDistance) {
                    minDistance = distance
                    closestInline = inlineEl
                }
            }
        }

        if (horizontallyAlignedInline) {
            closestInline = horizontallyAlignedInline
        }

        if (!closestInline) return null

        const inlineId = closestInline.dataset.inlineId
        if (!inlineId) return null

        let inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null

        const rect = closestInline.getBoundingClientRect()
        const relativeX = Math.max(0, Math.min(rect.width, clickX - rect.left))
        const textLength = inline.text.symbolic.length
        
        let position = Math.round((relativeX / Math.max(1, rect.width)) * textLength)
        
        const projectedClickY = rect.top + rect.height / 2
        
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(clickX, projectedClickY)
            if (range) {
                let targetInlineEl = closestInline
                let targetRect = rect
                
                if (!closestInline.contains(range.startContainer)) {
                    const rangeInlineEl = (range.startContainer.nodeType === Node.TEXT_NODE 
                        ? range.startContainer.parentElement 
                        : range.startContainer as HTMLElement)?.closest('[data-inline-id]') as HTMLElement
                    if (rangeInlineEl && blockElement?.contains(rangeInlineEl)) {
                        targetInlineEl = rangeInlineEl
                        targetRect = rangeInlineEl.getBoundingClientRect()
                        const rangeInlineId = rangeInlineEl.dataset.inlineId
                        if (rangeInlineId) {
                            const rangeInline = this.ast.query.getInlineById(rangeInlineId)
                            if (rangeInline) {
                                inline = rangeInline
                                const newRelativeX = Math.max(0, Math.min(targetRect.width, clickX - targetRect.left))
                                position = Math.round((newRelativeX / Math.max(1, targetRect.width)) * rangeInline.text.symbolic.length)
                            }
                        }
                    }
                }

                if (targetInlineEl.contains(range.startContainer) || targetInlineEl === range.startContainer) {
                    const tempRange = document.createRange()
                    tempRange.selectNodeContents(targetInlineEl)
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                }
            }
        } else if ((document as any).caretPositionFromPoint) {
            const caretPos = (document as any).caretPositionFromPoint(clickX, projectedClickY)
            if (caretPos) {
                const range = document.createRange()
                range.setStart(caretPos.offsetNode, caretPos.offset)
                range.collapse(true)
                
                if (closestInline.contains(range.startContainer) || closestInline === range.startContainer) {
                    const tempRange = document.createRange()
                    tempRange.selectNodeContents(closestInline)
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                }
            }
        }

        position = Math.max(0, Math.min(position, inline.text.symbolic.length))

        return { inline, position }
    }
    
    private resolveTextNodeAt(
        inlineEl: HTMLElement,
        offset: number
    ): { node: Text; offset: number } | null {
        let remaining = offset
    
        for (const child of inlineEl.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child as Text
                if (remaining <= text.length) {
                    return { node: text, offset: remaining }
                }
                remaining -= text.length
            } else if (child instanceof HTMLElement) {
                const len = child.textContent?.length ?? 0
                if (remaining <= len) {
                    const text = child.firstChild
                    if (text instanceof Text) {
                        return { node: text, offset: remaining }
                    }
                    return null
                }
                remaining -= len
            }
        }

        const last = inlineEl.lastChild
        if (last instanceof Text) {
            return { node: last, offset: last.length }
        }
    
        return null
    }    
}

export default Selection
