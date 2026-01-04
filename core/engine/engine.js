import { buildAst } from '../ast/ast';
import { uuid } from '../utils/utils';
export default class Engine {
    text = '';
    ast = buildAst('');
    constructor(text = '') {
        this.text = text;
        this.ast = buildAst(text);
    }
    setText(text) {
        if (this.text === '') {
            this.ast = buildAst(text);
        }
        this.text = text;
        // console.log('init ast', JSON.stringify(this.ast, null, 2))
    }
    getText() {
        return this.text;
    }
    getAst() {
        return this.ast;
    }
    createBlock(type, text, position, inlines) {
        const block = {
            id: uuid(),
            type,
            text,
            position,
            inlines,
        };
        return block;
    }
    getBlockById(id) {
        return this.findBlockByIdRecursive(id, this.ast?.blocks ?? []);
    }
    findBlockByIdRecursive(targetId, blocks) {
        for (const block of blocks) {
            if (block.id === targetId) {
                return block;
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findBlockByIdRecursive(targetId, block.blocks);
                if (found)
                    return found;
            }
        }
        return null;
    }
    getInlineById(id) {
        return this.findInlineByIdRecursive(id, this.ast?.blocks ?? []);
    }
    findInlineByIdRecursive(targetId, blocks) {
        for (const block of blocks) {
            for (const inline of block.inlines) {
                if (inline.id === targetId) {
                    return inline;
                }
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findInlineByIdRecursive(targetId, block.blocks);
                if (found)
                    return found;
            }
        }
        return null;
    }
}
