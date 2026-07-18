import type { DetectedBlock } from '../../../types'

function normalizeDetectLine(line: string): string {
    return line
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
        .replace(/\r$/, '')
}

function matchSetextUnderline(line: string): { level: 1 | 2; underline: string } | null {
    const normalized = normalizeDetectLine(line)
    const m = normalized.match(/^\s{0,3}(=+|-+)[ \t]*$/)
    if (!m) return null
    const underline = m[1]
    if (/^=+$/.test(underline)) return { level: 1, underline }
    if (/^-+$/.test(underline)) return { level: 2, underline }
    return null
}

function matchSetextHeading(text: string): { level: 1 | 2; underline: string; content: string } | null {
    const lines = text.replace(/\r$/, '').split('\n')
    if (lines.length < 2) return null

    const last = lines[lines.length - 1]
    const match = matchSetextUnderline(last)
    if (!match) return null

    const contentLines = lines.slice(0, -1)
    if (contentLines.length === 0) return null
    if (contentLines.some(l => normalizeDetectLine(l).trim() === '')) return null

    return {
        level: match.level,
        underline: match.underline,
        content: contentLines.join('\n'),
    }
}

const HTML_BLOCK_TAGS =
    'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'

function matchHtmlBlockStart(line: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
    const normalized = normalizeDetectLine(line)

    if (/^\s{0,3}<(?:script|pre|style|textarea)(?:\s|>|$)/i.test(normalized)) return 1
    if (/^\s{0,3}<!--/.test(normalized)) return 2
    if (/^\s{0,3}<\?/.test(normalized)) return 3
    if (/^\s{0,3}<![A-Z]/.test(normalized)) return 4
    if (/^\s{0,3}<!\[CDATA\[/.test(normalized)) return 5
    if (new RegExp(`^\\s{0,3}</?(?:${HTML_BLOCK_TAGS})(?:\\s|/?>|$)`, 'i').test(normalized)) return 6

    if (
        /^\s{0,3}<\/[a-zA-Z][a-zA-Z0-9-]*\s*>\s*$/.test(normalized) ||
        /^\s{0,3}<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>\s*$/.test(
            normalized
        )
    ) {
        return 7
    }

    return null
}

function matchHtmlBlockEnd(htmlType: number, line: string): boolean {
    const normalized = normalizeDetectLine(line)
    switch (htmlType) {
        case 1:
            return /<\/(?:script|pre|style|textarea)>/i.test(normalized)
        case 2:
            return /-->/.test(normalized)
        case 3:
            return /\?>/.test(normalized)
        case 4:
            return />/.test(normalized)
        case 5:
            return /\]\]>/.test(normalized)
        case 6:
        case 7:
            return normalized.trim() === ''
        default:
            return false
    }
}

function matchLinkReferenceDefinition(line: string): {
    label: string
    url: string
    title?: string
    rawLabel: string
} | null {
    const normalized = normalizeDetectLine(line)
    if (/^\s{0,3}\[\^/.test(normalized)) return null

    const m = normalized.match(
        /^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|\(((?:\\.|[^)\\])*)\)))?\s*$/
    )
    if (!m) return null

    const rawLabel = m[1]
    const label = rawLabel.toLowerCase().trim()
    if (!label) return null

    const url = m[2]
    const title = m[3] ?? m[4] ?? m[5]
    return title !== undefined ? { label, url, title, rawLabel } : { label, url, rawLabel }
}

function detectBlockType(line: string): DetectedBlock {
    line = normalizeDetectLine(line)

    const trimmed = line.trim()

    if (trimmed === '') return { type: 'blankLine' }

    const headingMatch = trimmed.match(/^(#{1,6})(?:\s+(.*))?$/)
    if (headingMatch) return { type: 'heading', level: headingMatch[1].length }

    if (/^>/.test(line)) return { type: 'blockQuote' }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return { type: 'thematicBreak' }

    if (/^\s{0,3}(```+|~~~+)/.test(line)) return { type: 'codeBlock' }

    // disabled
    // const taskListMatch = /^\s*([-*+])\s+\[([ xX])\](?:\s+|$)/.exec(line)
    // if (taskListMatch) {
    //     return {
    //         type: 'taskListItem',
    //         ordered: false,
    //         checked: taskListMatch[2].toLowerCase() === 'x',
    //     }
    // }

    const unorderedListMatch = /^\s*([-*+])\s+/.exec(line)
    if (unorderedListMatch) return { type: 'listItem', ordered: false }

    const orderedListMatch = /^\s*(\d{1,9})([.)])\s+/.exec(line)
    if (orderedListMatch) {
        return {
            type: 'listItem',
            ordered: true,
            listStart: parseInt(orderedListMatch[1], 10),
        }
    }

    if (/^ {4,}[^ ]/.test(line)) return { type: 'codeBlock' }

    if (/^\[\^[^\]]+\]:/.test(trimmed)) return { type: 'footnote' }

    const htmlType = matchHtmlBlockStart(line)
    if (htmlType) {
        return { type: 'htmlBlock', htmlType }
    }

    const linkRef = matchLinkReferenceDefinition(line)
    if (linkRef) {
        return { type: 'linkReferenceDefinition', label: linkRef.label }
    }

    return { type: 'paragraph' }
}

export {
    detectBlockType,
    normalizeDetectLine,
    matchSetextUnderline,
    matchSetextHeading,
    matchLinkReferenceDefinition,
    matchHtmlBlockStart,
    matchHtmlBlockEnd,
}
