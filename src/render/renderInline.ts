import { escape } from "../utils/escape"
import type { Inline } from "../types/inline"

function renderInline(inline: Inline): string {
    switch (inline.type) {
        case "Text":
            return escape(inline.value)
        case "Emphasis":
            return `<em>${inline.children.map(renderInline).join("")}</em>`
        case "Strong":
            return `<strong>${inline.children.map(renderInline).join("")}</strong>`
        case "CodeSpan":
            return `<code>${escape(inline.value)}</code>`
        case "Link": {
            const linkTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<a href="${escape(inline.url)}"${linkTitle}>${inline.children.map(renderInline).join("")}</a>`
        }
        case "Image": {
            const imgTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<img src="${escape(inline.url)}" alt="${escape(inline.alt)}"${imgTitle} />`
        }
        case "Autolink":
            return `<a href="${escape(inline.url)}">${escape(inline.url)}</a>`
        case "HTML":
            return inline.html
        case "SoftBreak":
            return " "
        case "HardBreak":
            return "<br />"
    }
}

export { renderInline }
