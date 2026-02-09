import Ast from './ast/ast'
import Caret from './caret'
import Select from './select/select'
import { SelectionRange, EditEffect, InputEvent, Block, Inline } from '../types'
import { strip } from '../utils/utils'

class Input {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public select: Select,
    ) {}

    public resolveEffect(event: InputEvent): EditEffect | null {
        console.log('resolveEffect', JSON.stringify(event, null, 2))
        const isInsert = event.type.startsWith('insert')
        const isDelete = event.type.startsWith('delete')
        if (!isInsert && !isDelete) return null
    
        const range = this.select?.resolveRange()
        console.log('range', JSON.stringify(range, null, 2))
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
        console.log('input resolveInsert', text, range)
        if (range.start.blockId !== range.end.blockId) {
            return this.resolveMultiBlockInsert(text, range)
        }

        const block = this.ast.query.getBlockById(range.start.blockId)
        console.log('input resolveInsert block', JSON.stringify(block, null, 2))
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        console.log('input resolveInsert inline', JSON.stringify(inline, null, 2))
        if (!inline) return null

        if (block.type === 'codeBlock') {
            console.log('input resolveInsert codeBlock')
            return this.resolveCodeBlockInsert(text, block, inline, range)
        }

        const startInlineIndex = block.inlines.findIndex(i => i.id === inline.id)
        const endInline = this.ast.query.getInlineById(range.end.inlineId)
        console.log('input resolveInsert endInline', JSON.stringify(endInline, null, 2))
        if (!endInline) return null

        if (inline.id === endInline.id) {
            const currentText = inline.text.symbolic
            // const newText = currentText.slice(0, range.start.position) + text + currentText.slice(range.end.position)
            // const newCaretPosition = range.start.position + text.length

            // console.log('input resolveInsert', newText, range.start.position, newCaretPosition)

            const isCollapsed =
                range.start.blockId === range.end.blockId &&
                range.start.inlineId === range.end.inlineId &&
                range.start.position === range.end.position

            const startPos = isCollapsed
                ? (this.caret.position ?? range.start.position)
                : range.start.position
              
            const endPos = isCollapsed
                ? startPos
                : range.end.position

            const newText =
                currentText.slice(0, startPos) + text + currentText.slice(endPos)
              
              const newCaretPosition = startPos + text.length

            console.log('input resolveInsert', isCollapsed,newText, startPos, endPos, newCaretPosition)

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

        const endInlineIndex = block.inlines.findIndex(i => i.id === endInline.id)
        
        const textBefore = block.inlines
            .slice(0, startInlineIndex)
            .map(i => i.text.symbolic)
            .join('') + inline.text.symbolic.slice(0, range.start.position)
        
        const textAfter = endInline.text.symbolic.slice(range.end.position) +
            block.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')
        
        const newText = textBefore + text + textAfter
        const newCaretPosition = textBefore.length + text.length

        console.log('input resolveInsert 2', newText, textBefore.length, newCaretPosition)

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

    private resolveCodeBlockInsert(text: string, block: any, inline: any, range: SelectionRange): EditEffect | null {
        // if (inline.type !== 'text') {
        //     const textInline = block.inlines.find((i: any) => i.type === 'text')
        //     if (!textInline) return null
            
        //     const currentText = textInline.text.symbolic
        //     const hasLeadingNewline = currentText.startsWith('\n')
        //     const insertPos = hasLeadingNewline ? 1 : 0
        //     const newText = currentText.slice(0, insertPos) + text + currentText.slice(insertPos)
        //     const newCaretPosition = insertPos + text.length
            
        //     return {
        //         preventDefault: true,
        //         ast: [{
        //             type: 'inputCodeBlock',
        //             text: newText,
        //             blockId: block.id,
        //             inlineId: textInline.id,
        //             caretPosition: newCaretPosition,
        //         }],
        //     }
        // }

        const currentText = inline.text.symbolic
        const newText = currentText.slice(0, range.start.position) + text + currentText.slice(range.end.position)
        const newCaretPosition = range.start.position + text.length

        return {
            preventDefault: true,
            ast: [{
                type: 'inputCodeBlock',
                text: newText,
                blockId: block.id,
                inlineId: inline.id,
                caretPosition: newCaretPosition,
            }],
        }
    }

    private resolveMultiBlockInsert(text: string, range: SelectionRange): EditEffect | null {
        const startBlock = this.ast.query.getBlockById(range.start.blockId)
        const startInline = this.ast.query.getInlineById(range.start.inlineId)
        if (!startBlock || !startInline) return null

        const endBlock = this.ast.query.getBlockById(range.end.blockId)
        const endInline = this.ast.query.getInlineById(range.end.inlineId)
        if (!endBlock || !endInline) return null

        if (text === '') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'deleteMultiBlock',
                    startBlockId: startBlock.id,
                    startInlineId: startInline.id,
                    startPosition: range.start.position,
                    endBlockId: endBlock.id,
                    endInlineId: endInline.id,
                    endPosition: range.end.position,
                }],
            }
        }

        return this.select.paste(text)
    }

    private resolveDelete(direction: 'backward' | 'forward', range: SelectionRange): EditEffect | null {
        const block = this.ast.query.getBlockById(range.start.blockId)
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        if (!inline) return null

        if (block.type === 'codeBlock') {
            return this.resolveCodeBlockDelete(direction, block, inline, range)
        }

        if (block.type === 'thematicBreak' && inline.type === 'marker') {
            const positionInline = range.start.position
            const position = this.caret.position ?? positionInline
            const currentText = inline.text.symbolic

            let newText: string
            let newCaretPosition: number

            if (direction === 'backward') {
                if (block.position.start === 0 && position === 0) {
                    return { preventDefault: true }
                }
                if (position === 0) {
                    const list = this.ast.query.getListFromBlock(block)
                    const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(inline) ?? this.ast.query.getPreviousInline(inline.id) : this.ast.query.getPreviousInline(inline.id)

                    if (previousInline && (strip(inline.text.symbolic).length === 0 || strip(previousInline.text.symbolic).length === 0)) {
                        if (previousInline) {
                            return {
                                preventDefault: true,
                                ast: [{
                                    type: 'mergeInline',
                                    leftInlineId: previousInline.id,
                                    rightInlineId: inline.id,
                                }],
                            }
                        }
                    }
                    return { preventDefault: true }
                }
                newText = currentText.slice(0, position - 1) + currentText.slice(position)
                newCaretPosition = position - 1
            } else {
                if (position >= currentText.length) {
                    return { preventDefault: true }
                }
                newText = currentText.slice(0, position) + currentText.slice(position + 1)
                newCaretPosition = position
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

        const list = this.ast.query.getListFromBlock(block)
        const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(inline) ?? this.ast.query.getPreviousInline(inline.id) : this.ast.query.getPreviousInline(inline.id)

        if (previousInline && (strip(inline.text.symbolic).length === 0 || strip(previousInline.text.symbolic).length === 0)) {
            if (previousInline) {
                return {
                    preventDefault: true,
                    ast: [{
                        type: 'mergeInline',
                        leftInlineId: previousInline.id,
                        rightInlineId: inline.id,
                    }],
                }
            }
        }

        const inlineIndex = block.inlines.findIndex(i => i.id === inline.id)

        const positionInline = range.start.position
        const position = this.caret.position ?? positionInline
        const currentText = inline.text.symbolic

        let newText: string
        let newCaretPosition: number

        if (direction === 'backward') {
            if (block.position.start === 0 && inlineIndex === 0 && position === 0) {
                return { preventDefault: true }
            }
            newText = currentText.slice(0, position - 1) + currentText.slice(position)
            newCaretPosition = position - 1
        } else {
            if (position >= currentText.length) {
                return { preventDefault: true }
            }
            newText = currentText.slice(0, position) + currentText.slice(position + 1)
            newCaretPosition = position
        }

        console.log('input resolveDelete', direction, newText, newCaretPosition, positionInline, this.caret.position)

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

    private resolveCodeBlockDelete(direction: 'backward' | 'forward', block: Block, inline: Inline, range: SelectionRange): EditEffect | null {
        const positionInline = range.start.position
        const position = this.caret.position ?? positionInline
        const currentText = inline.text.symbolic

        const cleanedText = currentText
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
            .replace(/\r$/, '')

        if (direction === 'backward') {
            // if (inline.type === 'marker') {
            //     if (inline === block.inlines[0] && inline.text.symbolic.replace('\n', '').length === 3) {
            //         return {
            //             preventDefault: true,
            //             ast: [{
            //                 type: 'exitCodeBlock',
            //                 blockId: block.id,
            //                 direction: 'current',
            //             }],
            //         }
            //     }

            //     return {
            //         preventDefault: true,
            //         ast: [{
            //             type: 'inputCodeBlock',
            //             blockId: block.id,
            //             inlineId: inline.id,
            //             text: cleanedText,
            //             caretPosition: position,
            //         }],
            //     }
            // }

            const newText = currentText.slice(0, position - 1) + currentText.slice(position)
            const newCaretPosition = position - 1

            return {
                preventDefault: true,
                ast: [{
                    type: 'inputCodeBlock',
                    text: newText,
                    blockId: block.id,
                    inlineId: inline.id,
                    caretPosition: newCaretPosition,
                }],
            }
        } else {
            if (position >= cleanedText.length) {
                return { preventDefault: true }
            }

            const newText = cleanedText.slice(0, position) + cleanedText.slice(position + 1)
            return {
                preventDefault: true,
                ast: [{
                    type: 'inputCodeBlock',
                    blockId: block.id,
                    inlineId: inline.id,
                    text: newText,
                    caretPosition: position,
                }],
            }
        }
    }
}

export default Input
