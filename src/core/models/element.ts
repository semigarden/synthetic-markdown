import AST from './ast'
import Caret from './caret'
import Selection from './selection'
import Editor from './editor'
import scss from '../styles/element.scss?inline'
import { buildAst } from '../ast/ast'
import { renderAST } from '../render/render'
import { onKey } from '../utils/key'

class Element extends HTMLElement {
    private shadowRootElement: ShadowRoot
    private styled = false
    private rootElement?: HTMLElement
    private ast = new AST()
    private caret: Caret | null = null
    private selection: Selection | null = null
    private editor: Editor | null = null
    private hasAcceptedExternalValue = false

    constructor() {
        super()
        this.shadowRootElement = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        const attrValue = this.getAttribute('value') ?? ''

        this.ast.setText(attrValue)
        this.ast.ast = buildAst(attrValue)

        this.addStyles()
        this.addDOM()
        this.render()

        this.caret = new Caret(this.rootElement!)
        this.editor = new Editor(this.rootElement!, this.ast, this.caret, this.emitChange.bind(this))
        this.selection = new Selection(this.rootElement!, this.ast, this.caret)
        this.selection.attach()
    }

    disconnectedCallback() {
        this.selection?.detach()
    }

    set value(value: string) {
        if (value === this.ast.getText()) return

        if (!this.hasAcceptedExternalValue && value !== '') {
            this.ast.setText(value)
            this.ast.ast = buildAst(value)
            this.render()
            this.hasAcceptedExternalValue = true
        }
    }

    get value() {
        return this.ast.getText()
    }

    private render() {
        if (!this.rootElement) return
        const ast = this.ast.getAst()
        if (!ast) return

        renderAST(ast, this.rootElement)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = scss
        this.shadowRootElement.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.rootElement) return
    
        const div = document.createElement('div')
        div.classList.add('element')

        div.addEventListener('input', (e: Event) => {
            this.editor?.onInput(e)
        })

        div.addEventListener('keydown', (event: KeyboardEvent) => {
            const intent = onKey[event.key]
            if (!intent) return

            event.preventDefault()
            this.editor?.onIntent(intent, event)
        })

        div.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.dataset?.inlineId) {
                // console.log('click on inline', target.dataset.inlineId)
            }
            if (target.dataset?.blockId) {
                // console.log('click on block', target.dataset.blockId)
                const block = this.ast.getBlockById(target.dataset.blockId)
                if (block) {
                    const lastInline = block.inlines.at(-1)
                    if (lastInline) {
                        this.caret?.setInlineId(lastInline.id)
                        this.caret?.setBlockId(block.id)
                        this.caret?.setPosition(lastInline.text.symbolic.length)
                        this.caret?.restoreCaret()
                    }
                }
            }
            if (target.classList.contains('element')) {
                // console.log('click on syntheticText')
                const lastBlock = this.ast.ast.blocks.at(-1)
                if (lastBlock) {
                    const lastInline = lastBlock.inlines.at(-1)
                    if (lastInline) {
                        this.caret?.setInlineId(lastInline.id)
                        this.caret?.setBlockId(lastBlock.id)
                        this.caret?.setPosition(lastInline.text.symbolic.length)
                        this.caret?.restoreCaret()
                    }
                }
            }
        })
    
        this.shadowRootElement.appendChild(div)
        this.rootElement = div
    }

    private emitChange() {
        console.log('emitChange')
        this.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true,
        }))
    }
}

export default Element
