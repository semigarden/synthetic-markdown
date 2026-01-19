import type Ast from '../ast/ast'
import type { Inline } from '../../types'
import { mapSemanticOffsetToSymbolic } from './map'

type FocusState = {
    focusedBlockId: string | null
    focusedInlineId: string | null
    focusedInlineIds: string[]
    focusedBlockIds: string[]
}

class Focus {
    constructor(
        private ast: Ast,
        private rootElement: HTMLElement,
    ) {}

    public focusInlines(inlineIds: string[]) {
        for (const inlineId of inlineIds) {
            this.focusInline(inlineId)
        }
    }

    public unfocusInlines(inlineIds: string[]) {
        for (const inlineId of inlineIds) {
            this.unfocusInline(inlineId)
        }
    }

    public focusBlocks(blockIds: string[]) {
        for (const blockId of blockIds) {
            this.focusBlock(blockId)
        }
    }

    public focusBlock(blockId: string) {
        const blockElement = this.rootElement.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement | null
        if (!blockElement) return
        blockElement.classList.add('focused')

        const markerElement = blockElement.querySelector('.marker') as HTMLElement | null
        if (markerElement) {
            markerElement.classList.add('focused')
        }
    }

    public unfocusBlocks(blockIds: string[]) {
        for (const blockId of blockIds) {
            this.unfocusBlock(blockId)
        }
    }

    public unfocusBlock(blockId: string) {
        const blockElement = this.rootElement.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement | null
        if (!blockElement) return
        blockElement.classList.remove('focused')

        const markerElement = blockElement.querySelector('.marker') as HTMLElement | null
        if (markerElement) {
            markerElement.classList.remove('focused')
        }
    }

    public clear(state: FocusState) {
        state.focusedInlineId = null
        state.focusedBlockId = null
    }

    public focusInline(
        inlineId: string
    ) {
        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineElement) return

        inlineElement.classList.add('focused')
    }

    public unfocusInline(inlineId: string) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineElement) return

        inlineElement.classList.remove('focused')
    }
}

export default Focus
