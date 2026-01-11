import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Selection from './selection'
import Timeline from './timeline'
import { SelectionRange, EditEffect, InputEvent, AstApplyEffect } from '../types'

class Input {
    public emitChange: () => void
    // public timeline: Timeline

    constructor(
        public ast: Ast,
        public caret: Caret,
        public selection: Selection,
        public render: Render,
        emitChange: () => void
    ) {
        this.emitChange = emitChange
        // this.timeline = new Timeline(this, { text: ast.text, blocks: ast.blocks, caret: { blockId: caret.blockId ?? '', inlineId: caret.inlineId ?? '', position: caret.position ?? 0, affinity: caret.affinity ?? 'start' } })
    }

    public resolveEffect(event: InputEvent): EditEffect | null {
        console.log('handle', event.text, event.type)
    
        const isInsert = event.type.startsWith('insert')
        const isDelete = event.type.startsWith('delete')
    
        if (!isInsert && !isDelete) return null
    
        const range = this.selection?.resolveRange()
        if (!range) return null

        const isCollapsed = range.start.blockId === range.end.blockId &&
            range.start.inlineId === range.end.inlineId &&
            range.start.position === range.end.position

        if (isInsert) {
            return this.resolveInsert(event.text, range)
        } else if (isDelete) {
            if (!isCollapsed) {
                return this.resolveInsert('', range)
            } else {
                const direction = event.type.includes('Backward') ? 'backward' : 'forward'
                return this.resolveDelete(direction, range)
            }
        }

        return null
    }

    private resolveInsert(text: string, range: SelectionRange): EditEffect | null {
        const block = this.ast.query.getBlockById(range.start.blockId)
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        if (!inline) return null

        const localStart = range.start.position
        const localEnd = range.end.inlineId === range.start.inlineId
            ? range.end.position
            : inline.text.symbolic.length

        const currentText = inline.text.symbolic
        const newText = currentText.slice(0, localStart) + text + currentText.slice(localEnd)

        const newCaretPosition = localStart + text.length

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: block.id,
                inlineId: inline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }

    private resolveDelete(direction: 'backward' | 'forward', range: SelectionRange): EditEffect | null {
        const block = this.ast.query.getBlockById(range.start.blockId)
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        if (!inline) return null

        const localPos = range.start.position
        const currentText = inline.text.symbolic

        let newText: string
        let newCaretPosition: number

        if (direction === 'backward') {
            if (localPos === 0) {
                return null
            }
            newText = currentText.slice(0, localPos - 1) + currentText.slice(localPos)
            newCaretPosition = localPos - 1
        } else {
            if (localPos >= currentText.length) {
                return null
            }
            newText = currentText.slice(0, localPos) + currentText.slice(localPos + 1)
            newCaretPosition = localPos
        }

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: block.id,
                inlineId: inline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }

    public apply(effect: EditEffect) {
        // this.timeline.push({ text: this.ast.text, blocks: this.ast.blocks, caret: { blockId: this.caret.blockId ?? '', inlineId: this.caret.inlineId ?? '', position: this.caret.position ?? 0, affinity: this.caret.affinity ?? 'start' } })
        
        if (effect.ast) {
            effect.ast.forEach(effect => {
                const effectTypes = ['input']
                if (effectTypes.includes(effect.type)) {
                    let result: AstApplyEffect | null = null
                    switch (effect.type) {
                        case 'input':
                            result = this.ast.input(effect.blockId, effect.inlineId, effect.text, effect.caretPosition)
                            break
                    }
                    if (!result) return

                    const { renderEffect, caretEffect } = result

                    this.ast.normalize()
                    this.render.apply(renderEffect)
                    this.caret.apply(caretEffect)
                    this.emitChange()
                }
            })
            // this.timeline.updateEvent({ text: this.ast.text, blocks: this.ast.blocks, caret: { blockId: this.caret.blockId ?? '', inlineId: this.caret.inlineId ?? '', position: this.caret.position ?? 0, affinity: this.caret.affinity ?? 'start' } })
        }
    }
}

export default Input
