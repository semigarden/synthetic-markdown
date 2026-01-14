import { uuid } from '../../../utils/utils'
import type { Block, DetectedBlock } from '../../../types'

function buildHeading(line: string, start: number, end: number, level: number): Block {
    return {
        id: uuid(),
        type: 'heading',
        level,
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildThematicBreak(line: string, start: number, end: number): Block {
    return {
        id: uuid(),
        type: 'thematicBreak',
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildParagraph(line: string, start: number, end: number): Block {
    return {
        id: uuid(),
        type: 'paragraph',
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildBlockQuote(
    originalLine: string,
    start: number,
    end: number,
    innerBlocks: Block[]
): Block {
    return {
        id: uuid(),
        type: 'blockQuote',
        text: originalLine,
        position: { start, end },
        blocks: innerBlocks,
        inlines: [],
    }
}

function buildFencedCodeBlock(
    line: string,
    start: number,
    end: number,
    fence: string,
    language: string | undefined
): Block {
    return {
        id: uuid(),
        type: 'codeBlock',
        text: line,
        language,
        isFenced: true,
        fence,
        position: { start, end },
        inlines: [],
    }
}

function buildIndentedCodeBlock(line: string, start: number, end: number): Block {
    return {
        id: uuid(),
        type: 'codeBlock',
        text: line.replace(/^ {4}/, ''),
        isFenced: false,
        position: { start, end },
        inlines: [],
    }
}

function buildListFromItem(
    line: string,
    start: number,
    end: number,
    detected: DetectedBlock
): Block {
    const markerMatch = /^(\s*([-*+]|(\d+[.)])))\s+/.exec(line)
    const markerLength = markerMatch ? markerMatch[0].length : 0
    const listItemText = line.slice(markerLength)

    const paragraph: Block = {
        id: uuid(),
        type: 'paragraph',
        text: listItemText,
        position: { start: start + markerLength, end },
        inlines: [],
    }

    const listItem: Block = {
        id: uuid(),
        type: 'listItem',
        text: markerMatch ? markerMatch[0] + listItemText : listItemText,
        position: { start, end },
        blocks: [paragraph],
        inlines: [],
    }

    return {
        id: uuid(),
        type: 'list',
        text: '',
        position: { start, end },
        ordered: !!(detected as any).ordered,
        listStart: (detected as any).listStart,
        tight: true,
        blocks: [listItem],
        inlines: [],
    }
}

export { buildHeading, buildThematicBreak, buildParagraph, buildBlockQuote, buildFencedCodeBlock, buildIndentedCodeBlock, buildListFromItem }
