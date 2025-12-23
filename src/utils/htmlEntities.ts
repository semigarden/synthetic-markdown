function decodeHTMLEntity(text: string): string {
    const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
    }

    for (const [entity, char] of Object.entries(entities)) {
        if (text.includes(entity)) {
            text = text.replace(
                new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                char,
            )
        }
    }

    text = text.replace(/&#(\d+);/g, (_, num) =>
        String.fromCharCode(parseInt(num, 10)),
    )
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
    )

    return text
}

export { decodeHTMLEntity }
