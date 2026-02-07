import Ast from './ast/ast'
import Input from './input'
import Intent from './intent'
import Editor from './editor'
import Select from './select/select'
import { Block, Intent as IntentType } from '../types'

class Interaction {
    private isComposing = false

    constructor(
        private rootElement: HTMLElement,
        private ast: Ast,
        private select: Select,
        private editor: Editor,
        private input: Input,
        private intent: Intent,
    ) {}

    attach() {
        this.rootElement.addEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.addEventListener('compositionstart', this.onCompositionStart)
        this.rootElement.addEventListener('compositionend', this.onCompositionEnd)
        this.rootElement.addEventListener('keydown', this.onKeyDown)
        this.rootElement.addEventListener('paste', this.onPaste)
        this.rootElement.addEventListener('copy', this.onCopy)
        this.rootElement.addEventListener('click', this.onClick)
    }

    detach() {
        this.rootElement.removeEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.removeEventListener('compositionstart', this.onCompositionStart)
        this.rootElement.removeEventListener('compositionend', this.onCompositionEnd)
        this.rootElement.removeEventListener('keydown', this.onKeyDown)
        this.rootElement.removeEventListener('paste', this.onPaste)
        this.rootElement.removeEventListener('copy', this.onCopy)
        this.rootElement.removeEventListener('click', this.onClick)
    }

    private onCompositionStart = () => {
        this.isComposing = true
    }

    private onCompositionEnd = () => {
        this.isComposing = false
    }

    private onBeforeInput = (event: InputEvent) => {
        console.log('onBeforeInput', event.inputType, event.data)
        if (event.inputType === 'insertFromPaste') {
            event.preventDefault()
            return
        }

        if (this.isComposing && event.isComposing) {
            console.log('onBeforeInput composing', event.data)
            return
        }

        if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
            event.preventDefault()
            return
        }

        // if (event.inputType === 'deleteContentBackward') {
        //     event.preventDefault()
        //     console.log('onBeforeInput deleteContentBackward', event.data)
        //     const context = this.select.resolveInlineContext()
        //     if (!context) return
        //     const effect = this.intent.resolveEffect('merge', context)
        //     if (!effect) return
        //     this.editor.apply(effect)
        //     return
        // }

        this.select.syncFromDomSelection()

        const effect = this.input.resolveEffect({ text: event.data ?? '', type: event.inputType })
        if (!effect) return
        // if (effect.preventDefault) {
        //     event.preventDefault()
        // }
        event.preventDefault()

        this.editor.apply(effect)
    }

    private onPaste = (event: ClipboardEvent) => {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!text) return

        const effect = this.select.paste(text)
        if (effect) {
            this.editor.apply(effect)
            this.select.clearSelection()
        }
    }

    private onCopy = (event: ClipboardEvent) => {
        const text = this.select.getSelectedText()
        if (text) {
            event.clipboardData?.setData('text/plain', text)
            event.preventDefault()
        }
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const intent = this.resolveIntentFromEvent(event)
        if (!intent) return

        if (intent === 'undo') {
            this.editor.undo()
            event.preventDefault()
            return
        }
        
        if (intent === 'redo') {
            this.editor.redo()
            event.preventDefault()
            return
        }

        const context = this.select.resolveInlineContext()
        if (!context) return

        const effect = this.intent.resolveEffect(intent, context)
        if (!effect) return

        if (effect.preventDefault) {
            event.preventDefault()
        }

        this.editor.apply(effect)
    }

    private onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (!target) return

        const checkbox = target.closest('.taskCheckbox') as HTMLInputElement | null
        if (checkbox) {
            event.preventDefault()

            const blockEl = checkbox.closest('[data-block-id]') as HTMLElement | null
            if (!blockEl) return

            requestAnimationFrame(() => {
                const blockId = blockEl.dataset.blockId
                if (!blockId) return

                const context = this.select.resolveTaskContext(blockId)
                if (!context) return

                const effect = this.intent.resolveEffect('toggleTask', context)
                if (!effect) return

                this.editor.apply(effect)
            })

            return
        }

        const anchor = target.closest('a') as HTMLAnchorElement | null
        if (anchor) {
            const follow = event.ctrlKey || event.metaKey
            if (!follow) {
                event.preventDefault()
                return
            }
            event.preventDefault()
            window.open(anchor.href, '_blank', 'noopener,noreferrer')
            return
        }

        // if (this.rootElement.contains(target)) {
        //     this.select.placeCaretAtPoint(event)
        // }
    }

    private resolveIntentFromEvent = (event: KeyboardEvent): IntentType | null => {
        const key = event.key.toLowerCase()
        if (event.ctrlKey) {
            if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
        }

        const context = this.select.resolveInlineContext()
        const isInCodeBlock = context?.block?.type === 'codeBlock'

        console.log('resolveIntentFromEvent', key, event.shiftKey, event.ctrlKey)

        if (event.shiftKey) {
            if (key === 'tab') return 'outdent'
            if (key === 'enter') {
                const parentBlock = this.ast.query.getParentBlock(context?.block as Block)
                if (parentBlock?.type === 'listItem' || parentBlock?.type === 'taskListItem' || parentBlock?.type === 'blockQuote') {
                    return 'indent'
                }
                return 'splitInCell'
            }
            if (key === 'backspace') {
                const parentBlock = this.ast.query.getParentBlock(context?.block as Block)
                if (parentBlock?.type === 'listItem' || parentBlock?.type === 'taskListItem' || parentBlock?.type === 'blockQuote') {
                    return 'outdent'
                }
                return 'insertRowAbove'
            }
        }

        if (isInCodeBlock) {
            if (event.ctrlKey && key === 'enter') {
                return 'exitCodeBlockBelow'
            }
            if (key === 'escape' || (event.ctrlKey && event.shiftKey && key === 'enter')) {
                return 'exitCodeBlockAbove'
            }
        }

        switch (key) {
            case 'tab': return 'indent'
            case 'enter': return 'split'
            case 'backspace': return 'merge'
        }
        
        return null
    }
}

export default Interaction
