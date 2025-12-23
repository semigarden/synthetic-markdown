function parseLinkDestinationAndTitle(
    text: string,
    start: number,
): { url: string; title?: string; end: number } | null {
    let pos = start
    if (pos >= text.length || text[pos] !== "(") return null
    pos++

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    if (pos >= text.length) return null

    let url = ""
    if (text[pos] === "<") {
        pos++
        const urlEnd = text.indexOf(">", pos)
        if (urlEnd === -1) return null
        url = text.slice(pos, urlEnd)
        pos = urlEnd + 1
    } else {
        const urlStart = pos
        while (pos < text.length && !/[ \t\n)]/.test(text[pos])) {
            if (text[pos] === "\\" && pos + 1 < text.length) {
                pos += 2
            } else {
                pos++
            }
        }
        url = text.slice(urlStart, pos)
        if (url.length === 0) return null
    }

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++

    let title: string | undefined = undefined
    if (
        pos < text.length &&
        (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")
    ) {
        const quoteChar = text[pos]
        pos++
        const titleStart = pos

        if (quoteChar === "(") {
            const titleEnd = text.indexOf(")", pos)
            if (titleEnd === -1) return null
            title = text.slice(pos, titleEnd)
            pos = titleEnd + 1
        } else {
            while (pos < text.length && text[pos] !== quoteChar) {
                if (text[pos] === "\\" && pos + 1 < text.length) {
                    pos += 2
                } else {
                    pos++
                }
            }
            if (pos >= text.length) return null
            title = text.slice(titleStart, pos)
            pos++
        }
    }

    while (pos < text.length && /[ \t]/.test(text[pos])) pos++

    if (pos >= text.length || text[pos] !== ")") return null
    pos++

    return { url, title, end: pos }
}

export { parseLinkDestinationAndTitle }
