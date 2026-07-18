import type { Block } from './block'
import type { Inline } from './inline'

export type EditContext = {
    block: Block
    inline: Inline
    inlineIndex: number
    inlineElement: HTMLElement
}

export type ParseBlockContext = {
    isFencedCodeBlock: boolean
    codeBlockFence: string
    codeBlockIndent: number
    currentCodeBlock: Block | null
    codeBlockLineCount: number

    isHtmlBlock: boolean
    htmlBlockType: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
    currentHtmlBlock: Block | null

    table?: {
        start: number
        headerLine: string
        dividerLine?: string
        rows: string[]
    }
}
