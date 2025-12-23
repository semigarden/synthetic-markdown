import type { LineState } from "../parse/context/LineState"
import type { Block } from "./block"
import type { Inline } from "./inline"

interface SyntheticTextProps {
    className?: string
    text: string
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void
    value?: string
    onBlur?: () => void
    props?: React.HTMLAttributes<HTMLDivElement>
}

interface BlockContext {
    type: string
    node: Block
    parent: BlockContext | null
    startIndex: number
    rawText: string
    canContinue(line: LineState): boolean
    addLine(text: string, originalLine: string): void
    finalize(endIndex: number): void
}

interface LinkReference {
    url: string
    title?: string
}

interface Delimiter {
    type: "*" | "_"
    length: number
    pos: number
    canOpen: boolean
    canClose: boolean
    node?: Inline
}

interface DocumentWithRefs extends Document {
    __linkReferences?: Map<string, LinkReference>
  }

export type { SyntheticTextProps, BlockContext, LinkReference, Delimiter, DocumentWithRefs }
