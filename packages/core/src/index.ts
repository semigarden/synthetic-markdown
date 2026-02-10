import Element from './models/element'

function defineElement(tag = 'synthetic-markdown') {
    if (typeof window === 'undefined') return
    if (!('customElements' in window)) return
    if (!customElements.get(tag)) {
        customElements.define(tag, Element)
    }
}

defineElement()

export { defineElement, Element }
export default Element
