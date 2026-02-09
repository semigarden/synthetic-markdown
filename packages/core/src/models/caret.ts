import { CaretEffect } from '../types'

class Caret {
    public blockId: string | null = null
    public inlineId: string | null = null
    public position: number | null = null
    public affinity?: 'start' | 'end'

    private restoreRafId: number | null = null
    private restoreToken = 0
    private composing = false

    private suppressSelectionToken = 0
    private suppressRafId: number | null = null

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

    public beginSelectionSuppress(token: number) {
        this.suppressSelectionToken = token

        if (this.suppressRafId !== null) cancelAnimationFrame(this.suppressRafId)

        this.suppressRafId = requestAnimationFrame(() => {
            this.suppressRafId = requestAnimationFrame(() => {
                if (this.suppressSelectionToken === token) {
                    this.suppressSelectionToken = 0
                }
                this.suppressRafId = null
            })
        })
    }

    public isSelectionSuppressed(token?: number) {
        if (this.suppressSelectionToken === 0) return false
        if (token === undefined) return true
        return this.suppressSelectionToken === token
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
        if (inlineId === null || position === null) return

        const inlineEl = this.rootElement.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement
        if (!inlineEl) return

        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl
        let textNode = target.firstChild instanceof Text ? target.firstChild : null

        if (!textNode) {
            target.textContent = ''
            textNode = target.ownerDocument.createTextNode('\u200B')
            target.appendChild(textNode)
        }

      
        const root = this.rootElement.getRootNode() as ShadowRoot | Document
        const selection =
            'getSelection' in root ? root.getSelection() : target.ownerDocument.getSelection()
        if (!selection) return

        this.rootElement.focus({ preventScroll: true })


        const range = target.ownerDocument.createRange()
        const max = textNode.data.length
        const clamped = Math.min(position, max)

        selection.removeAllRanges()
        range.setStart(textNode, clamped)
        range.collapse(true)
        selection.addRange(range)
    }

    public apply(effect: CaretEffect, caretToken: number, mode: 'microtask' | 'raf' | 'raf2') {
        switch (effect.type) {
            case 'restore': {
                const { blockId, inlineId, position, affinity } = effect.caret
                this.blockId = blockId
                this.inlineId = inlineId
                this.position = position
                this.affinity = affinity

                this.beginSelectionSuppress(caretToken)
                this.scheduleRestore(caretToken, inlineId, position, mode)
                break
            }
        }
    }

    private scheduleRestore(caretToken: number, inlineId: string, position: number, mode: 'microtask' | 'raf' | 'raf2') {
        this.restoreToken = caretToken

        if (this.restoreRafId !== null) cancelAnimationFrame(this.restoreRafId)

        const run = () => {
            if (this.composing) return
            if (caretToken !== this.restoreToken) return
            this.restoreCaret(inlineId, position)
        }
        
        if (mode === 'microtask') {
            queueMicrotask(run)
            return
        }
        
        if (mode === 'raf') {
            this.restoreRafId = requestAnimationFrame(() => {
                this.restoreRafId = null
                run()
            })
            return
        }
        
        this.restoreRafId = requestAnimationFrame(() => {
            this.restoreRafId = requestAnimationFrame(() => {
                this.restoreRafId = null
                run()
            })
        })
    }
}

export default Caret
