import { CaretEffect } from '../types'

class Caret {
    public blockId: string | null = null
    public inlineId: string | null = null
    public position: number | null = null
    public affinity?: 'start' | 'end'

    private restoreRafId: number | null = null
    private restoreToken = 0
    private composing = false

    constructor(
        private rootElement: HTMLElement,
    ) {}

    attach() {
        this.rootElement.addEventListener('compositionstart', this.onCompositionStart)
        this.rootElement.addEventListener('compositionend', this.onCompositionEnd)
    }

    detach() {
        this.rootElement.removeEventListener('compositionstart', this.onCompositionStart)
        this.rootElement.removeEventListener('compositionend', this.onCompositionEnd)
    }

    private onCompositionStart = () => {
        this.composing = true
    }

    private onCompositionEnd = () => {
        this.composing = false
    }

    clear() {
        this.blockId = null
        this.inlineId = null
        this.position = null
        this.affinity = undefined
    }

    getPositionInInline(inlineEl: HTMLElement) {
        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl
        const selection = target.ownerDocument.getSelection()

        let caretPositionInInline = 0
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const preRange = target.ownerDocument.createRange()
            preRange.selectNodeContents(target)
            preRange.setEnd(range.startContainer, range.startOffset)
            caretPositionInInline = preRange.toString().length
        }

        return caretPositionInInline
    }

    public restoreCaret(inlineId: string | null = this.inlineId, position: number | null = this.position) {
        console.log('restoreCaret', inlineId, position)
        if (inlineId === null || position === null) return
        if (this.rootElement.tabIndex < 0) this.rootElement.tabIndex = 0

        const inlineEl = this.rootElement.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement
        if (!inlineEl) {
            console.warn('could not find inline element for caret restore:', inlineId)
            return
        }

        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl

        if (target.childNodes.length === 0) {
            target.appendChild(target.ownerDocument.createTextNode('\u00A0'))
        }

        target.focus({ preventScroll: true })

        const selection = target.ownerDocument.getSelection()
        if (!selection) return

        selection.removeAllRanges()

        const range = target.ownerDocument.createRange()
        let placed = false

        if (target.childNodes.length > 0 && target.firstChild instanceof Text) {
            const textNode = target.firstChild as Text
            const clamped = Math.min(position, textNode.length)
            range.setStart(textNode, clamped)
            range.collapse(true)
            placed = true
        } else if (target.childNodes.length > 0) {
            let currentPos = 0
            const walker = target.ownerDocument.createTreeWalker(
                target,
                NodeFilter.SHOW_TEXT,
                null
            )

            let node: Text | null
            while ((node = walker.nextNode() as Text)) {
                const len = node.length
                if (currentPos + len >= position) {
                    range.setStart(node, position - currentPos)
                    range.collapse(true)
                    placed = true
                    break
                }
                currentPos += len
            }
        }

        if (!placed) {
            range.selectNodeContents(target)
            range.collapse(false)
        }

        selection.addRange(range)
        inlineEl.scrollIntoView({ block: 'nearest' })
    }
    
    public apply(effect: CaretEffect, caretToken: number) {
        switch (effect.type) {
            case 'restore': {
                const { blockId, inlineId, position, affinity } = effect.caret
                this.blockId = blockId
                this.inlineId = inlineId
                this.position = position
                this.affinity = affinity

                this.scheduleRestore(caretToken, inlineId, position)
                break
            }
        }
    }

    private scheduleRestore(caretToken: number, inlineId: string, position: number) {
        this.restoreToken = caretToken
        
        if (this.restoreRafId !== null) cancelAnimationFrame(this.restoreRafId)

        this.restoreRafId = requestAnimationFrame(() => {
            this.restoreRafId = null
            
            if (this.composing) return
            if (caretToken !== this.restoreToken) return

            this.restoreCaret(inlineId, position)
        })
    }
}

export default Caret
