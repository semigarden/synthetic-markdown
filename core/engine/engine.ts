import { buildAst } from '../ast/ast'
import { Document, Inline } from '../ast/types'

export default class Engine {
    private text = ''
    private ast: Document | null = null

    constructor(text = '') {
        this.text = text
    }
  
    setText(text: string) {
        if (this.text === '' && text !== '') {
            this.text = text
            this.ast = buildAst(text)
            console.log('buildAst', JSON.stringify(this.ast, null, 2))
        }
    }

    getText() {
        return this.text
    }

    getAst() {
        return this.ast
    }

    getInlineById(id: string): Inline | null {
        return this.findInlineByIdRecursive(this.ast?.inlines ?? [], id)
    }

    private findInlineByIdRecursive(inlines: Inline[], targetId: string): Inline | null {
        for (const inline of inlines) {
            if (inline.id === targetId) {
                return inline
            }
        }
        return null
    }
}
