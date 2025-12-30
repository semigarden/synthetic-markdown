import { buildAst } from '../ast/ast'
import { Block, Document, Inline } from '../ast/types'

export default class Engine {
    private text = ''
    private ast: Document | null = null

    constructor(text = '') {
        this.text = text
    }
  
    setText(text: string) {
        if (this.text === '' && text !== '') {
            this.ast = buildAst(text)
            console.log('buildAst', JSON.stringify(this.ast, null, 2))
        }
        this.text = text
    }

    getText() {
        return this.text
    }

    getAst() {
        return this.ast
    }

    getBlockById(id: string): Block | null {
        return this.findBlockByIdRecursive(this.ast?.blocks ?? [], id)
    }

    private findBlockByIdRecursive(blocks: Block[], targetId: string): Block | null {
        for (const block of blocks) {
            if (block.id === targetId) {
                return block
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findBlockByIdRecursive(block.blocks, targetId)
                if (found) return found
            }
        }
        return null
    }

    getInlineById(id: string): Inline | null {
        if (!this.ast?.blocks) return null;
      
        for (const block of this.ast.blocks) {
            const found = this.findInlineByIdRecursive(block.inlines, id);
            if (found) return found;
        }
      
        return null;
    }
      
    private findInlineByIdRecursive(inlines: Inline[], targetId: string): Inline | null {
        for (const inline of inlines) {
            if (inline.id === targetId) {
                return inline;
            }
        }
      
        return null;
    }
}
