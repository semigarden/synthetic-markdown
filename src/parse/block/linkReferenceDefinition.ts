function parseLinkReferenceDefinition(
    line: string,
): { label: string; url: string; title?: string } | null {
    const match = line.match(/^\[([^\]]+)\]:\s*(.+)$/)
    if (!match) return null

    const label = match[1].toLowerCase().trim()
    const rest = match[2].trim()

    let url = ""
    let title: string | undefined = undefined

    const titleMatch = rest.match(/^(.+?)\s+(["'])(.+?)\2\s*$/)
    if (titleMatch) {
        url = titleMatch[1].trim()
        title = titleMatch[3]
    } else {
        const titleParenMatch = rest.match(/^(.+?)\s+\((.+?)\)\s*$/)
        if (titleParenMatch) {
            url = titleParenMatch[1].trim()
            title = titleParenMatch[2]
        } else {
            url = rest
        }
    }

    if (url.startsWith("<") && url.endsWith(">")) {
        url = url.slice(1, -1)
    }

    return { label, url, title }
}

export { parseLinkReferenceDefinition }
