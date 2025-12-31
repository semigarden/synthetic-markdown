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
    private focusedBlockId: string | null = null
    private focusedInlineId: string | null = null


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
            console.log('selectionchange')
            if (this.isEditing) return;
            if (!this.syntheticEl) return;
        
            requestAnimationFrame(() => {
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

                const block = this.engine.getBlockById(inline.blockId);
                if (!block) return;

                this.caret.setInlineId(inlineId);
                this.caret.setBlockId(inline.blockId);
            
                const preRange = range.cloneRange();
                preRange.selectNodeContents(inlineEl);
                preRange.setEnd(range.startContainer, range.startOffset);
                let position = preRange.toString().length + inline.position.start + block.position.start;
            
                this.caret.setPosition(position);
            
                console.log('Caret moved to:', inlineId, 'position:', position);
            })
        });

        div.addEventListener('focusin', (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target.dataset?.inlineId) return;
          
            const inline = this.engine.getInlineById(target.dataset.inlineId!);
            if (!inline) return;

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);

            let clickOffset = 0;
            if (target.contains(range.startContainer)) {
                const preRange = document.createRange();
                preRange.selectNodeContents(target);
                preRange.setEnd(range.startContainer, range.startOffset);
                clickOffset = preRange.toString().length;
            }

            target.innerHTML = '';
            const newTextNode = document.createTextNode(inline.text.symbolic);
            target.appendChild(newTextNode);

            clickOffset = Math.max(0, Math.min(clickOffset, inline.text.symbolic.length));

            const newRange = document.createRange();
            newRange.setStart(newTextNode, clickOffset);
            newRange.collapse(true);

            selection.removeAllRanges();
            selection.addRange(newRange);

            this.focusedInlineId = inline.id;
            this.focusedBlockId = inline.blockId;
        });

        div.addEventListener('focusout', (e) => {
            if (this.focusedInlineId !== null) {
                const inlineEl = this.syntheticEl?.querySelector(`[data-inline-id="${this.focusedInlineId}"]`) as HTMLElement;
                if (!inlineEl) return;

                const inline = this.engine.getInlineById(this.focusedInlineId);
                if (inline) {
                    inlineEl.innerHTML = '';
                    const newTextNode = document.createTextNode(inline.text.semantic);
                    inlineEl.appendChild(newTextNode);
                }
            }

            console.log('focusout')
            if (!this.syntheticEl?.contains(e.relatedTarget as Node)) {
                const target = e.target as HTMLElement
                if (!target.dataset?.inlineId) return;

                const inlineId = target.dataset.inlineId!;
                const inline = this.engine.getInlineById(inlineId);
                if (!inline) return;

                target.innerHTML = '';
                const newTextNode = document.createTextNode(inline.text.semantic);
                target.appendChild(newTextNode);

                this.isEditing = false;
                this.caret.clear();
                this.focusedInlineId = null;
                this.focusedBlockId = null;
            }
        })
  
        div.addEventListener('input', this.onInput.bind(this))
    
        this.root.appendChild(div)
        this.syntheticEl = div
    }

    private onInput(e: Event) {
        console.log('input')
        if (!this.syntheticEl) return

        const target = e.target as HTMLDivElement
        if (!target.dataset?.inlineId) return

        const inlineId = target.dataset.inlineId!
        const inline = this.engine.getInlineById(inlineId)
        if (!inline) return

        const block = this.engine.getBlockById(inline.blockId)
        if (!block) return

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return

        // check if changed
        const newText = target.textContent ?? ''
        const oldText = inline.text.symbolic

        if (newText === oldText) return

        this.isEditing = true;

        // 

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

        

        let contextStart = inlineIndex
        let contextEnd = inlineIndex + 1

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

   

        console.log(`structural change detected: replacing 1 inline with ${JSON.stringify(newInlines, null, 2)}`)

        block.inlines.splice(contextStart, contextEnd - contextStart, ...newInlines)
        
        let targetCaretInline: Inline | null = null;
        let targetCaretOffset = this.caret.getPosition() ?? 0;

        const relativeCaretPos = targetCaretOffset - position

        let accumulatedLength = 0;
        for (const ni of newInlines) {
            const textLength = ni.text?.symbolic.length ?? 0;
            if (accumulatedLength + textLength >= relativeCaretPos) {
                targetCaretInline = ni;
                targetCaretOffset = relativeCaretPos - accumulatedLength;
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

        this.updateBlock(block)
        this.updateAST()

        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this.engine.getText() },
            bubbles: true,
            composed: true,
        }))

        this.isEditing = false;
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

    private updateBlock(block: Block) {
        let pos = 0;

        for (let i = 0; i < block.inlines.length; i++) {
            const inline = block.inlines[i];

            // Update inline id if missing or regenerate if needed
            if (!inline.id) {
                inline.id = crypto.randomUUID();
            }

            // Update inline position
            const textLength = inline.text.symbolic.length;
            inline.position = {
                start: pos,
                end: pos + textLength
            };

            pos += textLength;
        }

        // Update block text
        block.text = block.inlines.map(i => i.text.symbolic).join('');

        // Update block id if missing (optional)
        if (!block.id) {
            block.id = crypto.randomUUID();
        }

        // Update block position if you track it globally (optional)
        block.position = {
            start: block.inlines[0]?.position.start ?? 0,
            end: block.inlines[block.inlines.length - 1]?.position.end ?? 0
        };
    }

    private updateAST() {
        const ast = this.engine.getAst();
        if (!ast) return;

        let globalPos = 0; // tracks offset across all blocks

        for (const block of ast.blocks) {
            let blockStart = globalPos;

            // Update inlines positions
            let inlinePos = blockStart;
            for (const inline of block.inlines) {
                const textLength = inline.text.symbolic.length;

                // Ensure inline has an ID
                if (!inline.id) inline.id = crypto.randomUUID();

                // Update inline positions
                inline.position = { start: inlinePos, end: inlinePos + textLength };
                inlinePos += textLength;
            }

            // Update block text from inlines
            block.text = block.inlines.map(i => i.text.symbolic).join('');

            // Update block positions
            block.position = {
                start: blockStart,
                end: blockStart + block.text.length
            };

            // Ensure block has an ID
            if (!block.id) block.id = crypto.randomUUID();

            // Update global position (including newline between blocks)
            globalPos += block.text.length + 1; // +1 for '\n'
        }

        // Update engine text (concatenated)
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
