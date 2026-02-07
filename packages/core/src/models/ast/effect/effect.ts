import type { AstApplyEffect, Block, DomEffect, RenderDelete, RenderInsert, RenderInput } from '../../../types'

class Effect {
    update(insert: RenderInsert[], remove: Block[] = []): AstApplyEffect['renderEffect'] {
        return [{ type: 'update', render: { insert, remove } }]
    }

    input(input: RenderInput[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'input', input }]
    }

    deleteBlock(deleteBlock: RenderDelete[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'deleteBlock', deleteBlock }]
    }

    deleteInline(deleteInline: RenderDelete[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'deleteInline', deleteInline }]
    }

    insertBlock(insertBlock: RenderInsert[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'insertBlock', insertBlock }]
    }

    insertInline(insertInline: RenderInsert[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'insertInline', insertInline }]
    }

    caret(blockId: string, inlineId: string, position: number, affinity: 'start' | 'end' = 'start'): AstApplyEffect['caretEffect'] {
        return { type: 'restore', caret: { blockId, inlineId, position, affinity } }
    }

    dom(domEffect: DomEffect): AstApplyEffect['domEffect'] {
        return domEffect
    }

    compose(renderEffect: AstApplyEffect['renderEffect'][], caretEffect: AstApplyEffect['caretEffect'], domEffect: AstApplyEffect['domEffect']): AstApplyEffect {
        return { renderEffect: renderEffect.flat() as AstApplyEffect['renderEffect'], caretEffect, domEffect }
    }

    updateCurrent(target: Block, current: Block, remove: Block[] = []) {
        return this.update([{ type: 'block', at: 'current', target, current }], remove)
    }
}

export default Effect
