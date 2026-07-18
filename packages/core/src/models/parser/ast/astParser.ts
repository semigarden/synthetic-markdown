import BlockParser from '../block/blockParser'
import InlineParser from '../inline/inlineParser'
import LinkReferenceState from './linkReferenceState'
import { parseLinkReferenceDefinitions } from './linkReferences'
import { nestLists } from '../block/list/listNest'
import { matchSetextUnderline } from '../block/blockDetect'
import { isEmptyText } from '../../../utils/utils'
import type { OpenBlock, Block, List, BlockQuote, CodeBlock, Heading } from '../../../types'

function sanitize(text: string) {
    return text
    //   .replace(/\u200B/g, '')
      .replace(/[\u200C\u200D\uFEFF]/g, '')
      .replace(/\r$/, '')
}

function tryAbsorbSetext(blocks: Block[], candidate: Block, line: string): boolean {
    const match = matchSetextUnderline(line)
    if (!match) return false

    const prev = blocks[blocks.length - 1]
    if (!prev || prev.type !== 'paragraph') return false
    if (isEmptyText(String(prev.text ?? ''))) return false

    const content = String(prev.text ?? '').replace(/\r$/, '')
    Object.assign(prev, {
        type: 'heading',
        level: match.level,
        style: 'setext',
        underline: match.underline,
        text: `${content}\n${match.underline}`,
        position: { start: prev.position.start, end: candidate.position.end },
    } satisfies Partial<Heading>)
    return true
}

class AstParser {
    public linkReferences = new LinkReferenceState()
    public openBlocks: OpenBlock[] = []
    public blocks: Block[] = []

    public block = new BlockParser()
    public inline: InlineParser

    constructor() {
        this.inline = new InlineParser(this.linkReferences)
    }

    public parse(text: string): Block[] {
        this.reset()
        parseLinkReferenceDefinitions(text, this.linkReferences)

        this.block.reset()

        const blocks: Block[] = []
        let offset = 0

        for (const line of text.split('\n')) {
            const produced = this.block.line(line, offset)
            if (produced) {
                for (const b of produced) {
                    const last = blocks[blocks.length - 1]
            
                    if (last && last.type === 'list' && b.type === 'list' && last.ordered === (b as List).ordered) {
                        ;(last as List).blocks.push(...(b as List).blocks)
                        last.position.end = b.position.end
                        continue
                    }
                    
                    if (last && last.type === 'blockQuote' && b.type === 'blockQuote') {
                        ;(last as BlockQuote).blocks.push(...(b as BlockQuote).blocks)
                        last.position.end = b.position.end
                        continue
                    }

                    if (last && last.type === 'codeBlock' && b.type === 'codeBlock') {
                        const a = last as CodeBlock
                        const c = b as CodeBlock
                        if (!a.isFenced && !c.isFenced) {
                            a.text = a.text.length === 0 ? c.text : a.text + '\n' + c.text
                            a.position.end = c.position.end
                            continue
                        }
                    }

                    if (tryAbsorbSetext(blocks, b, line)) {
                        continue
                    }

                    blocks.push(b)
                }
            }
            offset += line.length + 1
        }

        const flushed = this.block.flush(offset)
        if (flushed) blocks.push(...flushed)

        this.mergeAdjacent(blocks)

        nestLists(blocks)

        for (const block of blocks) {
            this.inline.applyRecursive(block)
        }

        this.blocks = blocks

        return this.blocks
    }

    private mergeAdjacent(blocks: Block[]) {
        let i = 0
    
        while (i < blocks.length - 1) {
            const a = blocks[i]
            const b = blocks[i + 1]
    
            if (a.type === 'list' && b.type === 'list' && (a as any).ordered === (b as any).ordered) {
                ;(a as any).blocks.push(...(b as any).blocks)
                a.position.end = b.position.end
                blocks.splice(i + 1, 1)
                continue
            }
    
            if (a.type === 'blockQuote' && b.type === 'blockQuote') {
                ;(a as any).blocks.push(...(b as any).blocks)
                a.position.end = b.position.end
                blocks.splice(i + 1, 1)
                continue
            }
    
            i++
        }
    
        for (const block of blocks) {
            if ('blocks' in block && Array.isArray(block.blocks)) {
                this.mergeAdjacent(block.blocks)
            }
        }
    }

    public reparseTextFragment(text: string, offset: number): Block[] {
        this.block.reset()

        text = text.replace(/\r$/, '')

        const blocks: Block[] = []

        for (const line of text.split('\n')) {
            const produced = this.block.line(line, offset)
            if (produced) {
                for (const b of produced) {
                    if (tryAbsorbSetext(blocks, b, line)) {
                        offset += line.length + 1
                        continue
                    }
                    blocks.push(b)
                }
            }
            offset += line.length + 1
        }

        const flushed = this.block.flush(offset)
        if (flushed) blocks.push(...flushed)

        for (const block of blocks) {
            this.inline.applyRecursive(block)
        }

        return blocks
    }    

    private reset() {
        this.openBlocks = []
        this.blocks = []
    }
}

export default AstParser
