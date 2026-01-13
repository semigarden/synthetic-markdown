import Ast from '../ast/ast'
import Caret from '../caret'
import Focus from './focus'
import { getInlineElementFromNode } from './dom'
import { resolveRangeFromSelection, resolveInlineContext } from './map'
import type { EditContext, SelectionRange } from '../../types'

class Selection {
    private rafId: number | null = null
    private range: SelectionRange | null = null
    private suppressSelectionChange = false

    private focusState = {
        focusedBlockId: null as string | null,
        focusedInlineId: null as string | null,
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

    private onSelectionChange = () => {
        if (this.suppressSelectionChange) return

        if (this.rafId !== null) cancelAnimationFrame(this.rafId)

        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                this.range = null
                this.caret.clear()
                return
            }

            const domRange = selection.getRangeAt(0)

            if (domRange.collapsed) {
                const currentInlineEl = getInlineElementFromNode(domRange.startContainer)
                const currentInlineId = currentInlineEl?.dataset?.inlineId ?? null

                if (currentInlineId !== this.focusState.focusedInlineId) {
                    if (currentInlineId) {
                        const inline = this.ast.query.getInlineById(currentInlineId)
                        if (inline) this.focus.resolveBlockMarkerTransition(this.focusState, inline.blockId)
                    }

                    this.focus.resolveInlineTransition(
                        this.focusState,
                        currentInlineId,
                        selection,
                        domRange,
                        (v: boolean) => (this.suppressSelectionChange = v)
                    )
                }
            }

            this.range = resolveRangeFromSelection(this.ast, this.caret, selection)
            if (!this.range) {
                this.caret.clear()
            }
        })
    }

    private onRootFocusIn = (_e: FocusEvent) => {}

    private onRootFocusOut = (e: FocusEvent) => {
        if (!this.rootElement.contains(e.relatedTarget as Node)) {
            this.focus.unfocusCurrentInline(this.focusState)
            this.caret.clear()
            this.focus.clear(this.focusState)
        }
    }

    public resolveInlineContext(): EditContext | null {
        return resolveInlineContext(this.ast, this.caret, this.rootElement)
    }

    public resolveRange(): SelectionRange | null {
        return this.range
    }
}

export default Selection
