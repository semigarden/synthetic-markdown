import Ast from './ast/ast'
import Caret from './caret'
import Select from './select/select'
import Interaction from './interaction'
import Editor from './editor'
import Render from './render/render'
import Input from './input'
import Intent from './intent'
import cssText from '../styles/element-css'

class Element extends HTMLElement {
    private shadowRootElement: ShadowRoot
    private rootElement?: HTMLElement
    private ast = new Ast()
    private render: Render | null = null
    private caret: Caret | null = null
    private select: Select | null = null
    private interaction: Interaction | null = null
    private editor: Editor | null = null

    private input: Input | null = null
    private intent: Intent | null = null
    
    private styled = false
    private hasAcceptedExternalValue = false

    public hasAutofocus = false

    static get observedAttributes() {
        return ['autofocus']
    }

    constructor() {
        super()
        this.shadowRootElement = this.attachShadow({ mode: 'open' })
    }

    get value() {
        return this.ast.text
    }

    set value(value: string) {
        if (value === this.ast.text) return

        if (!this.hasAcceptedExternalValue && value !== '' || value !== '' && value !== this.ast.text) {
            this.ast.setText(value)
            this.renderDOM()
            this.setAutoFocus()
            this.hasAcceptedExternalValue = true
        }
    }

    get autofocus() {
        return this.hasAutofocus
    }

    set autofocus(value: any) {
        const on = value === true || value === '' || value === 'true' || value === 1 || value === '1'
        const currentlyOn = this.hasAttribute('autofocus')

        if (on && !currentlyOn) this.setAttribute('autofocus', '')
        if (!on && currentlyOn) this.removeAttribute('autofocus')

        this.hasAutofocus = on
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (name === 'autofocus') {
            this.hasAutofocus = this.hasAttribute('autofocus')
            this.setAutoFocus()
        }
    }

    connectedCallback() {
        const attrValue = this.getAttribute('value') ?? ''
        this.hasAutofocus = this.hasAttribute('autofocus')

        this.ast.setText(attrValue)

        this.addStyles()
        this.addDOM()

        this.render = new Render(this.rootElement!)
        this.caret = new Caret(this.rootElement!)
        this.select = new Select(this.ast, this.caret, this.rootElement!)
        this.editor = new Editor(this.ast, this.caret, this.render, this.emitChange.bind(this))
        this.select.attach()

        this.input = new Input(this.ast, this.caret, this.select)
        this.intent = new Intent(this.ast, this.caret, this.select, this.render)

        this.interaction = new Interaction(this.rootElement!, this.select, this.editor, this.input, this.intent)
        this.interaction.attach()

        this.renderDOM()
        this.setAutoFocus()
    }

    disconnectedCallback() {
        this.interaction?.detach()
        this.select?.detach()
        this.caret?.clear()
    }

    private renderDOM() {
        if (!this.rootElement) return
        if (!this.render) return

        this.render.renderBlocks(this.ast.blocks, this.rootElement)
    }

    private addStyles() {
        if (this.styled) return
      
        const style = document.createElement('style')
        style.textContent = cssText
        this.shadowRootElement.appendChild(style)
      
        this.styled = true
    }

    private addDOM() {
        if (this.rootElement) return
    
        const div = document.createElement('div')
        div.classList.add('element')
        div.contentEditable = 'true'

        this.shadowRootElement.appendChild(div)
        this.rootElement = div
    }

    private emitChange() {
        this.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true,
        }))
    }

    private setAutoFocus() {
        if (this.hasAutofocus && this.rootElement && this.select) this.select.autoFocus()
    }
}

export default Element
