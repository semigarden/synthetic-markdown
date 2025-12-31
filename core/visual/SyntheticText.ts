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

            let syntheticOffset = 0;
            if (target.contains(range.startContainer)) {
                const preRange = document.createRange();
                preRange.selectNodeContents(target);
                preRange.setEnd(range.startContainer, range.startOffset);
                syntheticOffset = preRange.toString().length;
            }

            const syntheticVisibleLength = target.textContent?.length ?? 1;

            target.innerHTML = '';
            const newTextNode = document.createTextNode(inline.text.symbolic);
            target.appendChild(newTextNode);

            const symbolicOffset = this.mapSyntheticOffsetToSymbolic(
                syntheticVisibleLength,
                inline.text.symbolic.length,
                syntheticOffset
            );

            const clampedOffset = Math.max(0, Math.min(symbolicOffset, inline.text.symbolic.length));
            const newRange = document.createRange();
            newRange.setStart(newTextNode, clampedOffset);
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
        const ctx = this.resolveInlineContext(e)
        if (!ctx) return
        const { inline, block, inlineIndex, inlineEl } = ctx
        const value = inlineEl.textContent ?? ''

        this.isEditing = true;

        const caretPositionInInline = this.caret.getPositionInInline(inlineEl)

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
            if (contextInlines[i].id === inline.id) {
                contextText += value
            } else {
                contextText += contextInlines[i].text.symbolic
            }
        }

        const position = block.inlines[contextStart].position.start
        const newInlines = parseInlineContent(contextText, inline.blockId, position)

   

        console.log(`structural change detected: replacing 1 inline with ${JSON.stringify(newInlines, null, 2)}`)

        block.inlines.splice(contextStart, contextEnd - contextStart, ...newInlines)
        
        const caretPositionInInlines = this.caret.getPositionInInlines(contextInlines, inline.id, caretPositionInInline)
        
        let { inline: caretInline, position: caretPosition } = this.caret.getInlineFromPositionInInlines(newInlines, caretPositionInInlines)

        if (!caretInline && newInlines.length > 0) {
            const lastInline = newInlines[newInlines.length - 1];
            caretInline = lastInline;
            caretPosition = lastInline.text.symbolic.length;
        }
    
        if (caretInline) {
            this.caret.setInlineId(caretInline.id);
            this.caret.setBlockId(caretInline.blockId);
            this.caret.setPosition(caretPosition);
        }

        console.log('new inlines', JSON.stringify(block.inlines, null, 2))

        renderBlock(block, this.syntheticEl!)

        this.restoreCaret()

        console.log(`inline${inline.id} changed: ${inline.text.symbolic} > ${value}`)

        this.updateBlock(block)
        this.updateAST()

        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this.engine.getText() },
            bubbles: true,
            composed: true,
        }))

        this.isEditing = false;
    }

    private updateBlock(block: Block) {
        let pos = 0;

        for (let i = 0; i < block.inlines.length; i++) {
            const inline = block.inlines[i];

            if (!inline.id) {
                inline.id = crypto.randomUUID();
            }

            const textLength = inline.text.symbolic.length;
            inline.position = {
                start: pos,
                end: pos + textLength
            };

            pos += textLength;
        }

        block.text = block.inlines.map(i => i.text.symbolic).join('');

        if (!block.id) {
            block.id = crypto.randomUUID();
        }

        block.position = {
            start: block.inlines[0]?.position.start ?? 0,
            end: block.inlines[block.inlines.length - 1]?.position.end ?? 0
        };
    }

    private updateAST() {
        const ast = this.engine.getAst();
        if (!ast) return;

        let globalPos = 0;

        for (const block of ast.blocks) {
            let blockStart = globalPos;

            let inlinePos = blockStart;
            for (const inline of block.inlines) {
                const textLength = inline.text.symbolic.length;

                if (!inline.id) inline.id = crypto.randomUUID();

                inline.position = { start: inlinePos, end: inlinePos + textLength };
                inlinePos += textLength;
            }

            block.text = block.inlines.map(i => i.text.symbolic).join('');

            block.position = {
                start: blockStart,
                end: blockStart + block.text.length
            };

            if (!block.id) block.id = crypto.randomUUID();

            globalPos += block.text.length + 1;
        }

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

    private mapSyntheticOffsetToSymbolic(
        syntheticLength: number,
        symbolicLength: number,
        syntheticOffset: number
    ) {
        if (syntheticOffset === 0) return 0;
        let ratio = symbolicLength / syntheticLength;
        ratio = Math.max(0.5, Math.min(2.0, ratio));
        let offset = Math.round(syntheticOffset * ratio);

        return Math.max(0, Math.min(offset, symbolicLength));
    }

    private resolveInlineContext(e: Event) {
        if (!this.syntheticEl) return null

        const target = e.target as HTMLDivElement
        if (!target.dataset?.inlineId) return null

        const inlineId = target.dataset.inlineId!
        const inline = this.engine.getInlineById(inlineId)
        if (!inline) return null

        const block = this.engine.getBlockById(inline.blockId)
        if (!block) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null

        const ctx: {
            inline: Inline,
            block: Block,
            inlineIndex: number,
            inlineEl: HTMLElement
        } = { inline, block, inlineIndex, inlineEl: target }

        return ctx
    }
}
