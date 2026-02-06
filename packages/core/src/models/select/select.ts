import Ast from '../ast/ast'
import Caret from '../caret'
import Focus from './focus'
import { getSelectedElements, resolveRange, resolveInlineContext } from './map'
import { findClosestInlineAndPosition } from './hit'
import type { EditContext, SelectionRange, EditEffect, Block, Inline } from '../../types'

class Select {
    private rafId: number | null = null
    private range: SelectionRange | null = null
    private suppressSelectionChange = false
    private multiInlineMode = false

    private focusState = {
        focusedBlockId: null as string | null,
        focusedInlineId: null as string | null,
        focusedInlineIds: [] as string[],
        focusedBlockIds: [] as string[],
    }

    private focus: Focus

    constructor(
        private ast: Ast,
        private caret: Caret,
        private rootElement: HTMLElement
    ) {
        this.focus = new Focus(ast, rootElement)
    }

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

    public autoFocus() {
        this.focus.autoFocus()
    }

    public placeCaretAtPoint(event: MouseEvent) {
        const target = event.target as Element | null
        if (!target || !this.rootElement.contains(target)) return

        const blockEl = target.closest('[data-block-id]') as HTMLElement | null
        if (!blockEl?.dataset?.blockId) return

        const block = this.ast.query.getBlockById(blockEl.dataset.blockId)
        if (!block) return

        const hit = findClosestInlineAndPosition(
            this.rootElement,
            block,
            event.clientX,
            event.clientY,
            (id) => this.ast.query.getInlineById(id)
        )
        if (!hit) return

        this.caret.blockId = block.id
        this.caret.inlineId = hit.inline.id
        this.caret.position = hit.position
        this.caret.restoreCaret(hit.inline.id, hit.position)
        this.focus.focusBlock(block.id)
        this.focus.focusInline(hit.inline.id)
    }

    public syncFromDomSelection(): void {
        const root = this.rootElement.getRootNode() as ShadowRoot | Document
        const selection =
            'getSelection' in root ? root.getSelection() : document.getSelection()
      
        if (!selection || selection.rangeCount === 0) return
      
        if (
            !this.rootElement.contains(selection.anchorNode) ||
            !this.rootElement.contains(selection.focusNode)
        ) return
      
        const range = resolveRange(this.ast, this.caret, this.rootElement, selection)
        if (!range) return
      
        this.range = range

        const collapsed =
            range.start.blockId === range.end.blockId &&
            range.start.inlineId === range.end.inlineId &&
            range.start.position === range.end.position
        
        if (collapsed) {
            this.caret.blockId = range.start.blockId
            this.caret.inlineId = range.start.inlineId
            this.caret.position = range.start.position
            this.caret.affinity = 'end'
        }
    }
      

    private onSelectionChange = () => {
        if (this.caret.isSelectionSuppressed()) return
        if (this.suppressSelectionChange) return

        if (this.rafId !== null) cancelAnimationFrame(this.rafId)

        this.rafId = requestAnimationFrame(() => {
            const shadowRoot = this.rootElement.getRootNode() as ShadowRoot | Document
            const selection = 'getSelection' in shadowRoot
                ? shadowRoot.getSelection()
                : document.getSelection()

            if (!selection || selection.rangeCount === 0) {
                if (this.rootElement.matches(':focus-within')) return

                this.range = null
                this.caret.clear()
                this.multiInlineMode = false

                this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
                this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                this.focusState.focusedBlockIds = []
                this.focusState.focusedInlineIds = []
                return
            }

            if (
                !this.rootElement.contains(selection.anchorNode) ||
                !this.rootElement.contains(selection.focusNode)
            ) {
                return
            }

            const selectedElements = getSelectedElements(this.rootElement, selection)

            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []

            for (const el of selectedElements.blockElements) {
                const blockId = el.dataset?.blockId ?? ''
                const block = this.ast.query.getBlockById(blockId)
                if (block) {
                    this.focusState.focusedBlockIds.push(block.id)
                }
            }

            for (const el of selectedElements.inlineElements) {
                const inlineId = el.dataset?.inlineId ?? ''
                const inline = this.ast.query.getInlineById(inlineId)
                if (inline) {
                    this.focusState.focusedInlineIds.push(inline.id)
                }
            }

            this.focus.focusBlocks(this.focusState.focusedBlockIds)
            this.focus.focusInlines(this.focusState.focusedInlineIds)

            const range = resolveRange(this.ast, this.caret, this.rootElement, selection)
            this.range = range
        })
    }

    private onRootFocusIn = () => {
        // const selection = window.getSelection()
        const shadowRoot = this.rootElement.getRootNode() as ShadowRoot | Document
        const selection = 'getSelection' in shadowRoot
            ? shadowRoot.getSelection()
            : document.getSelection()

        console.log('onRootFocusIn', selection)
        if (!selection || selection.rangeCount === 0) {
            if (this.rootElement.matches(':focus-within')) return

            this.range = null
            this.caret.clear()
            this.multiInlineMode = false

            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []
            console.log('onSelectionChange clear')
            return
        }

        if (
            !this.rootElement.contains(selection.anchorNode) ||
            !this.rootElement.contains(selection.focusNode)
        ) {
            console.log('onRootFocusIn not in editor')
            return
        }

        const selectedElements = getSelectedElements(this.rootElement, selection)

        this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
        this.focus.unfocusInlines(this.focusState.focusedInlineIds)
        this.focusState.focusedBlockIds = []
        this.focusState.focusedInlineIds = []

        for (const el of selectedElements.blockElements) {
            const blockId = el.dataset?.blockId ?? ''
            const block = this.ast.query.getBlockById(blockId)
            if (block) {
                this.focusState.focusedBlockIds.push(block.id)
            }
        }

        for (const el of selectedElements.inlineElements) {
            const inlineId = el.dataset?.inlineId ?? ''
            const inline = this.ast.query.getInlineById(inlineId)
            if (inline) {
                this.focusState.focusedInlineIds.push(inline.id)
            }
        }

        this.focus.focusBlocks(this.focusState.focusedBlockIds)
        this.focus.focusInlines(this.focusState.focusedInlineIds)

        const range = resolveRange(this.ast, this.caret, this.rootElement, selection)
        this.range = range
        console.log('onRootFocusIn range', JSON.stringify(range, null, 2), selection)
    }

    private onRootFocusOut = (e: FocusEvent) => {
        if (!this.rootElement.contains(e.relatedTarget as Node)) {
            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.caret.clear()
            this.focus.clear(this.focusState)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []
            this.multiInlineMode = false
        }
    }

    public resolveInlineContext(): EditContext | null {
        return resolveInlineContext(this.ast, this.caret, this.rootElement)
    }

    public resolveTaskContext(blockId: string): EditContext | null {
        const block = this.ast.query.getBlockById(blockId)
        if (!block) return null

        const blockElement = this.rootElement.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
        if (!blockElement) return null

        const inlineElement = this.placeCaretInFirstInline(blockElement, 'start')
        if (!inlineElement) return null

        const inlineId = inlineElement.dataset.inlineId
        if (!inlineId) return null

        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null
        
        this.caret.blockId = block.id
        this.caret.inlineId = inline.id
        this.caret.position = 0

        return { block, inline, inlineIndex: 0, inlineElement: inlineElement }
    }

    private placeCaretInFirstInline(blockEl: HTMLElement, at: 'start' | 'end' = 'start') {
        const inlineEl = blockEl.querySelector('[data-inline-id]') as HTMLElement | null
        if (!inlineEl) return null

        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl

        if (target.childNodes.length === 0) {
            target.appendChild(target.ownerDocument.createTextNode('\u00A0'))
        }

        this.rootElement.focus()

        const root = this.rootElement.getRootNode() as ShadowRoot | Document
        const selection = 'getSelection' in root ? root.getSelection() : target.ownerDocument.getSelection()
        if (!selection) return null

        const range = target.ownerDocument.createRange()
        range.selectNodeContents(target)
        range.collapse(at === 'start')

        selection.removeAllRanges()
        selection.addRange(range)

        return inlineEl
    }

    public resolveRange(): SelectionRange | null {
        return this.range
    }

    public isMultiInlineMode(): boolean {
        return this.multiInlineMode
    }

    public clearSelection() {
        this.range = null
        this.multiInlineMode = false
        this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
        this.focus.unfocusInlines(this.focusState.focusedInlineIds)
        this.focusState.focusedBlockIds = []
        this.focusState.focusedInlineIds = []
        this.focusState.focusedBlockId = null
        this.focusState.focusedInlineId = null
    }

    public getSelectedText(): string {
        if (!this.range) return ''
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const endBlock = this.ast.query.getBlockById(this.range.end.blockId)
        if (!startBlock || !endBlock) return ''
        
        const getOffsetInBlock = (block: typeof startBlock, inlineId: string, position: number): number => {
            let offset = 0
            for (const inline of block.inlines) {
                if (inline.id === inlineId) {
                    return offset + position
                }
                offset += inline.text.symbolic.length
            }
            return offset
        }
        
        const startOffset = getOffsetInBlock(startBlock, this.range.start.inlineId, this.range.start.position)
        const endOffset = getOffsetInBlock(endBlock, this.range.end.inlineId, this.range.end.position)
        
        const startTextPos = startBlock.position.start + startOffset
        const endTextPos = endBlock.position.start + endOffset

        return this.ast.text.slice(startTextPos, endTextPos)
    }

    public paste(text: string): EditEffect | null {
        const hasNewlines = text.includes('\n')
        
        if (!this.range) {
            const context = this.resolveInlineContext()
            if (!context) return null
            
            if (hasNewlines) {
                return this.pasteMultiBlock(text, context.block, context.inline, this.caret.position ?? 0)
            }
            
            const caretPosition = this.caret.position ?? 0
            const currentText = context.inline.text.symbolic
            const newText = currentText.slice(0, caretPosition) + text + currentText.slice(caretPosition)
            const newCaretPosition = caretPosition + text.length

            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        if (this.range.start.blockId !== this.range.end.blockId) {
            return null
        }
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const startInline = this.ast.query.getInlineById(this.range.start.inlineId)
        if (!startBlock || !startInline) return null
        
        if (hasNewlines) {
            return this.pasteMultiBlock(text, startBlock, startInline, this.range.start.position, {
                inlineId: this.range.end.inlineId,
                position: this.range.end.position
            })
        }
        
        const startInlineIndex = startBlock.inlines.findIndex(i => i.id === startInline.id)
        const endInline = this.ast.query.getInlineById(this.range.end.inlineId)
        if (!endInline) return null
        
        if (startInline.id === endInline.id) {
            const currentText = startInline.text.symbolic
            const newText = currentText.slice(0, this.range.start.position) + text + currentText.slice(this.range.end.position)
            const newCaretPosition = this.range.start.position + text.length

            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: startBlock.id,
                    inlineId: startInline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        const endInlineIndex = startBlock.inlines.findIndex(i => i.id === endInline.id)
        
        const textBefore = startBlock.inlines
            .slice(0, startInlineIndex)
            .map(i => i.text.symbolic)
            .join('') + startInline.text.symbolic.slice(0, this.range.start.position)
        
        const textAfter = endInline.text.symbolic.slice(this.range.end.position) +
            startBlock.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')
        
        const newText = textBefore + text + textAfter
        const newCaretPosition = this.range.start.position + text.length

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: startBlock.id,
                inlineId: startInline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }

    private pasteMultiBlock(
        text: string,
        block: Block,
        inline: Inline,
        startPosition: number,
        endRange?: { inlineId: string; position: number }
    ): EditEffect | null {
        const endPosition = endRange ? endRange.position : undefined
        
        return {
            preventDefault: true,
            ast: [{
                type: 'pasteMultiBlock',
                blockId: block.id,
                inlineId: inline.id,
                text: text,
                startPosition: startPosition,
                endPosition: endPosition,
            }],
        }
    }
}

export default Select
