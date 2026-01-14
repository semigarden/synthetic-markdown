import type Ast from '../ast/ast'
import type { Inline } from '../../types'
import { mapSemanticOffsetToSymbolic } from './map'

type FocusState = {
    focusedBlockId: string | null
    focusedInlineId: string | null
}

class Focus {
    constructor(private ast: Ast, private rootElement: HTMLElement) {}

    public resolveInlineTransition(
        state: FocusState,
        newInlineId: string | null,
        selection: globalThis.Selection,
        range: Range,
        setSuppress: (v: boolean) => void
    ) {
        if (state.focusedInlineId) this.unfocusInline(state.focusedInlineId)
        if (newInlineId) this.focusInline(newInlineId, selection, range, setSuppress)

        state.focusedInlineId = newInlineId
    }

    public unfocusCurrentInline(state: FocusState) {
        if (state.focusedInlineId) this.unfocusInline(state.focusedInlineId)
    }

    public clear(state: FocusState) {
        state.focusedInlineId = null
        state.focusedBlockId = null
    }

    private focusInline(
        inlineId: string,
        selection: globalThis.Selection,
        range: Range,
        setSuppress: (v: boolean) => void
    ) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return

        const inlineEl = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineEl) return

        let localOffset = 0
        if (inlineEl.contains(range.startContainer)) {
            const preRange = document.createRange()
            preRange.selectNodeContents(inlineEl)
            preRange.setEnd(range.startContainer, range.startOffset)
            localOffset = preRange.toString().length
        }

        const symbolicOffset = mapSemanticOffsetToSymbolic(
            inline.text.semantic.length,
            inline.text.symbolic.length,
            localOffset
        )

        setSuppress(true)
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

        requestAnimationFrame(() => setSuppress(false))
    }

    public resolveBlockMarkerTransition(state: FocusState, newBlockId: string) {
        if (newBlockId === state.focusedBlockId) return

        if (state.focusedBlockId) {
            const prev = this.ast.query.getBlockById(state.focusedBlockId)
            if (prev) {
                const marker = prev.inlines.find(i => i.type === 'marker')
                if (marker && marker.text.symbolic.length > 0) {
                    const markerEl = this.rootElement.querySelector(
                        `[data-inline-id="${marker.id}"]`
                    ) as HTMLElement | null
                    if (markerEl) markerEl.textContent = marker.text.symbolic
                }
            }
        }

        state.focusedBlockId = newBlockId
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
        if (!block) return

        const marker = block.inlines.find(i => i.type === 'marker') as Inline | undefined
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
    }
}

export default Focus
