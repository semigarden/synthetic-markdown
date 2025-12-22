type Inline =
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Image
    | Autolink
    | HTML
    | SoftBreak
    | HardBreak

interface Text {
    type: "Text"
    value: string
}

interface Emphasis {
    type: "Emphasis"
    children: Inline[]
}

interface Strong {
    type: "Strong"
    children: Inline[]
}

interface CodeSpan {
    type: "CodeSpan"
    value: string
}

interface Link {
    type: "Link"
    url: string
    title?: string
    children: Inline[]
}

interface Image {
    type: "Image"
    url: string
    alt: string
    title?: string
    children: Inline[]
}

interface SoftBreak {
    type: "SoftBreak"
}

interface HardBreak {
    type: "HardBreak"
}

interface Autolink {
    type: "Autolink"
    url: string
}

interface HTML {
    type: "HTML"
    html: string
}

export type {
    Inline,
    Text,
    Emphasis,
    Strong,
    CodeSpan,
    Link,
    Image,
    Autolink,
    HTML,
    SoftBreak,
    HardBreak,
}
