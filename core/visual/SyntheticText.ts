import Engine from '../engine/engine'
import Caret from './caret'
import { renderAST } from '../render/render'
import { renderBlock } from '../render/renderBlock'
import css from './SyntheticText.scss?inline'
import { parseInlineContent } from '../ast/ast'
import { Block, Inline } from '../ast/types'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private syntheticEl?: HTMLDivElement
    private engine = new Engine()
    private caret = new Caret()
    private connected = false
    private isRendered = false
    private isEditing = false

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        this.connected = true
        this.engine = new Engine(this.textContent ?? '')
        this.addStyles()
        this.addDOM()
    }

    set value(value: string) {
        this.engine.setText(value)
        if (this.connected && !this.isRendered) {
          this.render()
          this.isRendered = true
        }
    }

    get value() {
        return this.engine.getText()
    }

    private render() {
        if (!this.syntheticEl) return
        const ast = this.engine.getAst()
        if (!ast) return

        renderAST(ast, this.syntheticEl)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = css
        this.root.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.syntheticEl) return
    
        const div = document.createElement('div')
        div.classList.add('syntheticText')

        document.addEventListener('selectionchange', () => {
            if (!this.syntheticEl) return;
        
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
          
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
          
            let inlineEl: HTMLElement | null = null;
          
            if (container instanceof HTMLElement) {
              inlineEl = container.closest('[data-inline-id]') ?? null;
            } else if (container instanceof Text) {
              inlineEl = container.parentElement?.closest('[data-inline-id]') ?? null;
            }
          
            if (!inlineEl || !this.syntheticEl?.contains(inlineEl)) {
              this.caret.clear();
              return;
            }
          
            const inlineId = inlineEl.dataset.inlineId!;
            const inline = this.engine.getInlineById(inlineId);
            if (!inline) return;
          
            this.caret.setInlineId(inlineId);
            this.caret.setBlockId(inline.blockId);
          
            const preRange = range.cloneRange();
            preRange.selectNodeContents(inlineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            const position = preRange.toString().length;
          
            this.caret.setPosition(position);
          
            console.log('Caret moved to:', inlineId, 'position:', position);
        });

        div.addEventListener('focusin', (e: FocusEvent) => {
            console.log('focusin')
            const target = e.target as HTMLElement
            if (!target.dataset?.inlineId) return;

            const inlineId = target.dataset.inlineId!;
            console.log('focusin on inline:', inlineId);

            const inline = this.engine.getInlineById(inlineId);
            if (!inline) return;

            target.textContent = inline.text.symbolic

            this.isEditing = true;
            this.caret.setInlineId(inlineId);
            this.caret.setBlockId(inline.blockId);

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);

            if (range.commonAncestorContainer.parentElement?.closest('[data-inline-id]') === target ||
                range.commonAncestorContainer === target) {

                let position: number;

                if (range.startContainer === target) {
                    position = range.startOffset;
                } else {
                    const textNode = range.startContainer as Text;
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(target);
                    preCaretRange.setEnd(range.startContainer, range.startOffset);
                    position = preCaretRange.toString().length;
                }
                
                this.caret.setPosition(position);
                console.log('caret position:', position, 'in text:', target.textContent);
            }
        })

        div.addEventListener('focusout', (e) => {
            console.log('focusout')
            if (!this.syntheticEl?.contains(e.relatedTarget as Node)) {
                const target = e.target as HTMLElement
                if (!target.dataset?.inlineId) return;

                const inlineId = target.dataset.inlineId!;
                const inline = this.engine.getInlineById(inlineId);
                if (!inline) return;

                target.textContent = inline.text.semantic

                this.isEditing = false;
                this.caret.clear();
            }
        })
  
        div.addEventListener('input', this.onInput.bind(this))
    
        this.root.appendChild(div)
        this.syntheticEl = div
    }

    private onInput(e: Event) {
        if (!this.syntheticEl) return

        const target = e.target as HTMLDivElement

        if (!target.dataset?.inlineId) return

        const inlineId = target.dataset.inlineId!
        const inline = this.engine.getInlineById(inlineId)
        if (!inline) return

        console.log('inline', JSON.stringify(inline, null, 2))

        const block = this.engine.getBlockById(inline.blockId)
        if (!block) return

        console.log('block', JSON.stringify(block, null, 2))

        const newText = target.textContent ?? ''
        const oldText = inline.text.symbolic

        if (newText === oldText) return

        const sel = window.getSelection();
        let caretOffset = 0;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                caretOffset = range.startOffset;
            } else {
                caretOffset = 0;
            }
        }

        const index = block.inlines.findIndex(i => i.id === inlineId)

        if (index === -1) return

        let contextStart = index
        let contextEnd = index + 1

        while (contextStart > 0 && block.inlines[contextStart - 1].type === 'text') {
            contextStart--
        }

        while (contextEnd < block.inlines.length && block.inlines[contextEnd].type === 'text') {
            contextEnd++
        }

        let contextText = ''
        const contextInlines = block.inlines.slice(contextStart, contextEnd)
        for (let i = 0; i < contextInlines.length; i++) {
            const inline = contextInlines[i]
            if (inline.id === inlineId) {
                contextText += newText
            } else {
                contextText += inline.text.symbolic
            }
        }

        const position = block.inlines[contextStart].position.start
        const newInlines = parseInlineContent(contextText, inline.blockId, position)

   

        console.log(`structural change detected: replacing 1 inline with ${newInlines.length}`)

        block.inlines.splice(contextStart, contextEnd - contextStart, ...newInlines)
        
        let targetCaretInline: Inline | null = null;
        let targetCaretOffset = caretOffset;

        let accumulatedLength = 0;
        for (const ni of newInlines) {
            const textLength = ni.text?.symbolic.length ?? 0;
            if (accumulatedLength + textLength >= caretOffset) {
                targetCaretInline = ni;
                targetCaretOffset = caretOffset - accumulatedLength;
                break;
            }
            accumulatedLength += textLength;
        }

        if (!targetCaretInline && newInlines.length > 0) {
            const firstText = newInlines.find(i => i.type === 'text');
            if (firstText) {
                targetCaretInline = firstText;
                targetCaretOffset = firstText.text.symbolic.length;
            }
        }
    
        if (targetCaretInline) {
            this.caret.setInlineId(targetCaretInline.id);
            this.caret.setBlockId(targetCaretInline.blockId);
            this.caret.setPosition(targetCaretOffset);
        }

        console.log('new inlines', JSON.stringify(block.inlines, null, 2))

        renderBlock(block, this.syntheticEl)

        this.restoreCaret()

        console.log(`inline${inline.id} changed: ${oldText} > ${newText}`)

        this.updateBlockText(block)
        this.updateASTText()

        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this.engine.getText() },
            bubbles: true,
            composed: true,
        }))
    }

    private shouldSkipReplacement(oldInlines: Inline[], newInlines: Inline[]): boolean {
        if (oldInlines.length !== newInlines.length) return false;
      
        for (let i = 0; i < oldInlines.length; i++) {
          const oldI = oldInlines[i];
          const newI = newInlines[i];
          if (oldI.type !== newI.type) return false;
          if (oldI.type === 'text' && oldI.text.symbolic !== newI.text.symbolic) return false;
          if (oldI.type !== 'text' && oldI.text.symbolic !== newI.text.symbolic) return false;
        }
      
        return true;
    }

    private updateBlockText(block: Block) {
        block.text = block.inlines.map(i => i.text.symbolic).join('');
    }

    private updateASTText() {
        const ast = this.engine.getAst()
        if (!ast) return;
        this.engine.setText(ast.blocks.map(b => b.text).join('\n'));
    }

    private restoreCaret() {
        if (!this.caret.getInlineId() || this.caret.getPosition() === null) {
          return;
        }
      
        const inlineId = this.caret.getInlineId()!;
        const position = this.caret.getPosition()!;
      
        const inlineEl = this.syntheticEl?.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement;
        if (!inlineEl) {
          console.warn('Could not find inline element for caret restore:', inlineId);
          return;
        }
      
        inlineEl.focus();
      
        const selection = window.getSelection();
        if (!selection) return;
      
        selection.removeAllRanges();
        const range = document.createRange();
      
        try {
          let placed = false;
      
          if (inlineEl.childNodes.length > 0 && inlineEl.firstChild instanceof Text) {
            const textNode = inlineEl.firstChild as Text;
            const clamped = Math.min(position, textNode.length);
            range.setStart(textNode, clamped);
            range.collapse(true);
            placed = true;
          } 
          else if (inlineEl.childNodes.length > 0) {
            let currentPos = 0;
            const walker = document.createTreeWalker(
              inlineEl,
              NodeFilter.SHOW_TEXT,
              null
            );
      
            let node: Text | null;
            while ((node = walker.nextNode() as Text)) {
              const len = node.length;
              if (currentPos + len >= position) {
                range.setStart(node, position - currentPos);
                range.collapse(true);
                placed = true;
                break;
              }
              currentPos += len;
            }
          }
      
          if (!placed) {
            if (inlineEl.childNodes.length > 0) {
              range.selectNodeContents(inlineEl);
              range.collapse(false);
            } else {
              range.setStart(inlineEl, 0);
              range.collapse(true);
            }
          }
      
          selection.addRange(range);
      
          inlineEl.focus();
      
          inlineEl.scrollIntoView({ block: 'nearest' });
      
        } catch (err) {
          console.warn('Failed to restore caret:', err);
          inlineEl.focus();
        }
      }
}
