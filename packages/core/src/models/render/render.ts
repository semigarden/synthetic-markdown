import BlockRender from './blockRender'
import { renderInline as createInlineElement } from './inlineRender'
import { normalizeTables } from './tableNormalizer'
import type { Block, Inline, RenderEffect, RenderPosition } from '../../types'

class Render {
    private rootElement: HTMLElement
    private blockRender: BlockRender

    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement
        this.blockRender = new BlockRender()
    }

    public renderBlocks(blocks: Block[], rootElement: HTMLElement = this.rootElement) {
        this.blockRender.renderBlocks(blocks, rootElement)
    }

    public renderBlock(
        block: Block,
        parentElement: HTMLElement = this.rootElement,
        renderAt: RenderPosition = 'current',
        targetBlock: Block | null = null
    ): HTMLElement {
        return this.blockRender.renderBlock(block, parentElement, renderAt, targetBlock)
    }

    public renderInline(inline: Inline): HTMLElement {
        return createInlineElement(inline)
    }

    public insertInlineAt(
        current: Inline,
        at: RenderPosition,
        target: Inline
    ): void {
        const targetElement = this.rootElement.querySelector(
            `[data-inline-id="${target.id}"]`
        ) as HTMLElement | null
        if (!targetElement) return

        const element = createInlineElement(current)
        switch (at) {
            case 'current':
                // targetElement.replaceWith(element)
                this.patchInlineElement(targetElement, element)
                break
            case 'previous':
                targetElement.before(element)
                break
            case 'next':
                targetElement.after(element)
                break
        }
    }

    public apply(effects: RenderEffect[]) {
        for (const effect of effects) {
            switch (effect.type) {
                case 'update':
                    const removedIds = new Set<string>()
                    effect.render.remove.forEach(block => {
                        if (removedIds.has(block.id)) return
                        const removeBlockElement = this.rootElement.querySelector(
                            `[data-block-id="${block.id}"]`
                        ) as HTMLElement | null
                        if (removeBlockElement) {
                            removeBlockElement.remove()
                            removedIds.add(block.id)
                        }
                    })

                    effect.render.insert.filter(render => render.type === 'block').forEach(render => {
                        this.renderBlock(render.current, this.rootElement, render.at, render.target)
                    })

                    normalizeTables(this.rootElement)
                    break
                case 'input':
                    effect.input.forEach(input => {
                        const block = this.rootElement.querySelector(`[data-block-id="${input.blockId}"]`) as HTMLElement | null
                        if (!block) return

                        const inline = block.querySelector(`[data-inline-id="${input.inlineId}"]`) as HTMLElement | null
                        if (!inline) return

                        const symbolic = inline.querySelector(`.symbolic`) as HTMLElement | null
                        const semantic = inline.querySelector(`.semantic`) as HTMLElement | null
                        
                        if (!symbolic || !semantic) return

                        // const setText = (el: HTMLElement, value: string) => {
                        //     const first = el.firstChild
                        //     if (first instanceof Text) {
                        //         first.data = value
                        //         while (first.nextSibling) first.nextSibling.remove()
                        //         return
                        //     }
                        //     el.textContent = value
                        // }

                        switch (input.type) {
                            case 'codeBlockMarker':
                                block.setAttribute('data-language', input.language ?? '')
                                // symbolic.textContent = input.text
                                this.setText(symbolic, input.text)
                                break
                            case 'text':
                                // symbolic.textContent = input.symbolic
                                // semantic.textContent = input.semantic
                                this.setText(symbolic, input.symbolic)
                                this.setText(semantic, input.semantic)
                                break
                        }
                    })
                    break
                case 'insertInline':
                    effect.insertInline.forEach(({ current, at, target }) => {
                        this.insertInlineAt(current, at, target)
                    })
                    break
                // case 'deleteBlock':
                //     effect.deleteBlock.forEach(deleteBlock => {
                //         const block = this.rootElement.querySelector(`[data-block-id="${deleteBlock.blockId}"]`) as HTMLElement | null
                //         if (!block) return
                //         block.remove()
                //     })
                //     break
                case 'deleteInline':
                    effect.deleteInline.forEach(deleteInline => {
                        const block = this.rootElement.querySelector(`[data-block-id="${deleteInline.blockId}"]`) as HTMLElement | null
                        if (!block) return

                        const inline = block.querySelector(`[data-inline-id="${deleteInline.inlineId}"]`) as HTMLElement | null
                        if (!inline) return
                        inline.remove()
                    })
                    break
            }
        }
    }

    private patchInlineElement(existing: HTMLElement, next: HTMLElement) {
        for (const { name } of Array.from(existing.attributes)) {
            if (!next.hasAttribute(name)) existing.removeAttribute(name)
        }
        for (const { name, value } of Array.from(next.attributes)) {
            if (existing.getAttribute(name) !== value) existing.setAttribute(name, value)
        }

        const nextSymbolic = next.querySelector('.symbolic') as HTMLElement | null
        const nextSemantic = next.querySelector('.semantic') as HTMLElement | null
        const curSymbolic = existing.querySelector('.symbolic') as HTMLElement | null
        const curSemantic = existing.querySelector('.semantic') as HTMLElement | null

        if (nextSymbolic && curSymbolic) {
            this.setText(curSymbolic, nextSymbolic.textContent ?? '')
        }
        if (nextSemantic && curSemantic) {
            this.setText(curSemantic, nextSemantic.textContent ?? '')
        }
    }

    private setText(element: HTMLElement, value: string) {
        const isSymbolic = element.classList.contains('symbolic')
        console.log('setText', value.length, isSymbolic)
        const v = value.length ? this.normalizeSymbolicText(value) : (isSymbolic ? '\u00A0' : '')
        const first = element.firstChild
        if (first instanceof Text) {
            first.data = v
            while (first.nextSibling) first.nextSibling.remove()
            return
        }
        element.textContent = ''
        element.appendChild(element.ownerDocument.createTextNode(v))
    }

    private normalizeSymbolicText(text: string): string {
        console.log('normalizeSymbolicText', text)
        if (/^\u200B+$/.test(text)) {
            return '\u00A0'
        }
        return text
    }
}

export default Render
