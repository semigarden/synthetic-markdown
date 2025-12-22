import type { Inline } from '@/types/Inline'

export interface ContainerBlock<T extends string = string> {
  type: T
  children: Block[]
}

type Block =
  | Document
  | Paragraph
  | Heading
  | BlockQuote
  | List
  | ListItem
  | CodeBlock
  | ThematicBreak
  | HTMLBlock

interface Document extends ContainerBlock<'document'> {}

interface Paragraph {
  type: 'paragraph'
  children: Inline[]
}

interface Heading {
  type: 'heading'
  level: number
  children: Inline[]
}

interface BlockQuote extends ContainerBlock<'blockQuote'> {}

interface List extends ContainerBlock<'list'> {
  ordered: boolean
  start?: number
  tight?: boolean
}

interface ListItem extends ContainerBlock<'listItem'> {
  checked?: boolean
}

interface CodeBlock {
  type: 'codeBlock'
  language: string
  code: string
}

interface ThematicBreak {
  type: 'thematicBreak'
}

interface HTMLBlock {
  type: 'htmlBlock'
  html: string
}

export type {
  Block,
  Document,
  Paragraph,
  Heading,
  BlockQuote,
  List,
  ListItem,
  CodeBlock,
  ThematicBreak,
  HTMLBlock,
}
