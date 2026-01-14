interface InlineType<T extends string = string> {
    id: string
    blockId: string
    type: T
    text: {
        symbolic: string
        semantic: string
    }
    position: {
        start: number
        end: number
    }
}

export type Inline =
    | Marker
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Autolink
    | Image
    | Strikethrough
    | FootnoteRef
    | Emoji
    | SoftBreak
    | HardBreak
    | RawHTML
    | Entity

export interface Marker extends InlineType<'marker'> {
}

export interface Text extends InlineType<'text'> {
}

export interface Emphasis extends InlineType<'emphasis'> {
}

export interface Strong extends InlineType<'strong'> {
}

export interface CodeSpan extends InlineType<'codeSpan'> {
}

export interface Link extends InlineType<'link'> {
    url: string
    title?: string
}

export interface Autolink extends InlineType<'autolink'> {
    url: string
}

export interface Image extends InlineType<'image'> {
    url: string
    alt: string
    title?: string
}

export interface Strikethrough extends InlineType<'strikethrough'> {
}

export interface FootnoteRef extends InlineType<'footnoteRef'> {
    label: string
}

export interface Emoji extends InlineType<'emoji'> {
    name: string
}

export interface SoftBreak extends InlineType<'softBreak'> {
}

export interface HardBreak extends InlineType<'hardBreak'> {
}

export interface RawHTML extends InlineType<'rawHTML'> {
}

export interface Entity extends InlineType<'entity'> {
    decoded: string
}
