import type { Block, Heading, Inline } from '../../types'
import { snapLeftOfEmptyChar } from '../../utils/utils'

type InlineHit = { inline: Inline; position: number }

function isHitIgnoredInline(el: HTMLElement): boolean {
    return (
        el.classList.contains('setext-break') ||
        el.classList.contains('softBreak') ||
        el.classList.contains('hardBreak')
    )
}

function collectHitInlineElements(blockElement: HTMLElement): HTMLElement[] {
    return Array.from(blockElement.querySelectorAll('[data-inline-id]')).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && !isHitIgnoredInline(el)
    )
}

function filterSetextRowInlines(
    blockElement: HTMLElement,
    inlineElements: HTMLElement[],
    clickY: number
): HTMLElement[] {
    if (!blockElement.classList.contains('setext')) return inlineElements

    const contentWrap = blockElement.querySelector('.setext-content') as HTMLElement | null
    const markerEl = blockElement.querySelector(':scope > .inline.marker') as HTMLElement | null
    if (!contentWrap && !markerEl) return inlineElements

    const contentRect = contentWrap?.getBoundingClientRect()
    const markerRect = markerEl?.getBoundingClientRect()

    let preferMarker = false
    if (contentRect && markerRect) {
        const midY = (contentRect.bottom + markerRect.top) / 2
        preferMarker = clickY >= midY
    } else if (markerRect) {
        preferMarker = clickY >= markerRect.top
    }

    const row = inlineElements.filter(el => {
        const inContent = contentWrap?.contains(el) ?? false
        const isMarker = el.classList.contains('marker')
        return preferMarker ? isMarker : inContent || !isMarker
    })

    return row.length > 0 ? row : inlineElements
}

function pickClosestInlineElement(
    inlineElements: HTMLElement[],
    clickX: number,
    clickY: number
): HTMLElement | null {
    let closestInline: HTMLElement | null = null
    let minDistance = Infinity
    let horizontallyAlignedInline: HTMLElement | null = null
    let minVerticalDistance = Infinity

    for (const inlineEl of inlineElements) {
        const rect = inlineEl.getBoundingClientRect()
        if (rect.width <= 0 && rect.height <= 0) continue

        const isHorizontallyAligned = clickX >= rect.left && clickX <= rect.right

        if (isHorizontallyAligned) {
            const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
            if (verticalDistance < minVerticalDistance) {
                minVerticalDistance = verticalDistance
                horizontallyAlignedInline = inlineEl
            }
        } else {
            const horizontalDistance = Math.min(
                Math.abs(clickX - rect.left),
                Math.abs(clickX - rect.right)
            )
            const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
            const distance = horizontalDistance + verticalDistance

            if (distance < minDistance) {
                minDistance = distance
                closestInline = inlineEl
            }
        }
    }

    return horizontallyAlignedInline ?? closestInline
}

function findClosestInlineAndPosition(
    rootElement: HTMLElement,
    block: Block,
    clickX: number,
    clickY: number,
    getInlineById: (id: string) => Inline | null
): InlineHit | null {
    const blockElement = rootElement.querySelector(
        `[data-block-id="${block.id}"]`
    ) as HTMLElement | null
    if (!blockElement) return null

    let inlineElements = collectHitInlineElements(blockElement)
    if (inlineElements.length === 0) return null

    inlineElements = filterSetextRowInlines(blockElement, inlineElements, clickY)

    let closestInline = pickClosestInlineElement(inlineElements, clickX, clickY)
    if (!closestInline) return null

    const inlineId = closestInline.dataset.inlineId
    if (!inlineId) return null

    let inline = getInlineById(inlineId)
    if (!inline) return null

    if (inline.type === 'softBreak' || inline.type === 'hardBreak') {
        const content = block.inlines.find(i => i.type !== 'marker' && i.type !== 'softBreak' && i.type !== 'hardBreak')
        const marker = block.inlines.find(i => i.type === 'marker')
        const heading = block as Heading
        const preferMarker =
            heading.style === 'setext' &&
            marker &&
            (() => {
                const markerEl = blockElement.querySelector(
                    `[data-inline-id="${marker.id}"]`
                ) as HTMLElement | null
                const rect = markerEl?.getBoundingClientRect()
                return rect ? clickY >= rect.top : false
            })()
        inline = (preferMarker ? marker : content) ?? marker ?? content ?? inline
        closestInline =
            (blockElement.querySelector(`[data-inline-id="${inline.id}"]`) as HTMLElement | null) ??
            closestInline
    }

    const rect = closestInline.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(rect.width, clickX - rect.left))
    const textLength = inline.text.symbolic.length

    let position = Math.round((relativeX / Math.max(1, rect.width)) * textLength)

    if (
        blockElement.classList.contains('setext') &&
        clickX > rect.right &&
        (
            closestInline.classList.contains('marker') ||
            blockElement.querySelector('.setext-content')?.contains(closestInline)
        )
    ) {
        position = textLength
    }

    const projectedClickY = rect.top + rect.height / 2

    const docAny = document as any

    if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(clickX, projectedClickY)
        if (range) {
            let targetInlineEl = closestInline
            let targetRect = rect

            if (!closestInline.contains(range.startContainer)) {
                const rangeInlineEl = (
                    range.startContainer.nodeType === Node.TEXT_NODE
                        ? range.startContainer.parentElement
                        : (range.startContainer as HTMLElement)
                )?.closest('[data-inline-id]') as HTMLElement | null

                if (
                    rangeInlineEl &&
                    blockElement.contains(rangeInlineEl) &&
                    !isHitIgnoredInline(rangeInlineEl)
                ) {
                    targetInlineEl = rangeInlineEl
                    targetRect = rangeInlineEl.getBoundingClientRect()

                    const rangeInlineId = rangeInlineEl.dataset.inlineId
                    if (rangeInlineId) {
                        const rangeInline = getInlineById(rangeInlineId)
                        if (rangeInline && rangeInline.type !== 'softBreak' && rangeInline.type !== 'hardBreak') {
                            inline = rangeInline
                            const newRelativeX = Math.max(
                                0,
                                Math.min(targetRect.width, clickX - targetRect.left)
                            )
                            position = Math.round(
                                (newRelativeX / Math.max(1, targetRect.width)) *
                                    rangeInline.text.symbolic.length
                            )
                        }
                    }
                }
            }

            if (targetInlineEl.contains(range.startContainer) || targetInlineEl === range.startContainer) {
                const symbolicEl = (targetInlineEl.querySelector('.symbolic') as HTMLElement | null) ?? targetInlineEl
                const tempRange = document.createRange()
                tempRange.selectNodeContents(symbolicEl)
                try {
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                } catch {}
            }
        }
    } else if (docAny.caretPositionFromPoint) {
        const caretPos = docAny.caretPositionFromPoint(clickX, projectedClickY)
        if (caretPos) {
            const range = document.createRange()
            range.setStart(caretPos.offsetNode, caretPos.offset)
            range.collapse(true)

            if (closestInline.contains(range.startContainer) || closestInline === range.startContainer) {
                const symbolicEl = (closestInline.querySelector('.symbolic') as HTMLElement | null) ?? closestInline
                const tempRange = document.createRange()
                tempRange.selectNodeContents(symbolicEl)
                try {
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                } catch {}
            }
        }
    }

    position = snapLeftOfEmptyChar(inline.text.symbolic, position)
    return { inline, position }
}

function resolveTextNodeAt(
    inlineEl: HTMLElement,
    offset: number
): { node: Text; offset: number } | null {
    let remaining = offset

    for (const child of Array.from(inlineEl.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child as Text
            if (remaining <= text.length) return { node: text, offset: remaining }
            remaining -= text.length
        } else if (child instanceof HTMLElement) {
            const len = child.textContent?.length ?? 0
            if (remaining <= len) {
                const text = child.firstChild
                if (text instanceof Text) return { node: text, offset: remaining }
                return null
            }
            remaining -= len
        }
    }

    const last = inlineEl.lastChild
    if (last instanceof Text) return { node: last, offset: last.length }

    return null
}

export { findClosestInlineAndPosition, resolveTextNodeAt }
export type { InlineHit }
