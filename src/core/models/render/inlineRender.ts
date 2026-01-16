import type { Inline } from '../../types'

function getInlineTag(inline: Inline): string {
    switch (inline.type) {
        case 'text':
            return 'span'
        case 'emphasis':
            return 'em'
        case 'strong':
            return 'strong'
        case 'codeSpan':
            return 'code'
        case 'link':
            return 'a'
        case 'autolink':
            return 'a'
        case 'image':
            return 'img'
        case 'strikethrough':
            return 's'
        default:
            return 'span'
    }
}

function renderInlines(inlines: Inline[], parent: HTMLElement) {
    parent.replaceChildren()

    for (const inline of inlines) {
        const { symbolic, semantic } = renderInline(inline)
        parent.appendChild(symbolic)
        parent.appendChild(semantic)
    }
}

function renderInline(inline: Inline): { symbolic: Node; semantic: Node } {
    const tag = getInlineTag(inline)
    const inlineElement = document.createElement(tag)
    const inlineSymbolicElement = document.createElement(tag)

    inlineSymbolicElement.id = inline.id
    inlineSymbolicElement.dataset.inlineId = inline.id
    inlineSymbolicElement.textContent = inline.text.symbolic
    inlineSymbolicElement.contentEditable = 'false'
    inlineSymbolicElement.classList.add('inline', inline.type, 'symbolic')

    inlineElement.id = inline.id
    inlineElement.dataset.inlineId = inline.id
    inlineElement.textContent = inline.text.semantic
    inlineElement.contentEditable = 'false'
    inlineElement.classList.add('inline', inline.type, 'semantic')

    if (inline.type === 'link') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url || ''
        ;(inlineElement as HTMLAnchorElement).title = inline.title || ''
    }

    if (inline.type === 'autolink') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url || ''
    }

    if (inline.type === 'image') {
        ;(inlineElement as HTMLImageElement).src = inline.url || ''
        ;(inlineElement as HTMLImageElement).alt = inline.alt || ''
        ;(inlineElement as HTMLImageElement).title = inline.title || ''
        inlineElement.textContent = '';
    }

    return { symbolic: inlineSymbolicElement, semantic: inlineElement }
}

export { renderInlines }
