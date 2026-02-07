import type { Block, List, ListItem, TaskListItem } from '../../../../types'
import { uuid } from '../../../../utils/utils'

type AnyListItem = ListItem | TaskListItem

function markerIndent(item: AnyListItem): number {
    // item.text contains marker including leading spaces ("- " or "  - ")
    const m = /^\s*/.exec(item.text)
    return m ? m[0].length : 0
}

function lastListItem(list: List): AnyListItem | null {
    const blocks = list.blocks as AnyListItem[]
    return blocks.length ? blocks[blocks.length - 1] : null
}

function ensureNestedList(parentItem: AnyListItem, template: List): List {
    const blocks = parentItem.blocks as Block[]
    const last = blocks.length ? blocks[blocks.length - 1] : null

    if (last && last.type === 'list') {
        const l = last as List
        if (l.ordered === template.ordered) return l
    }

    const nested: List = {
        id: uuid(),
        type: 'list',
        text: '',
        position: { start: parentItem.position.end, end: parentItem.position.end },
        ordered: template.ordered,
        listStart: template.listStart,
        tight: template.tight,
        blocks: [],
        inlines: [],
    }

    blocks.push(nested)
    return nested
}

function recalcListPositionAndText(list: List) {
    const items = list.blocks as AnyListItem[]
    if (items.length === 0) {
        list.text = ''
        return
    }

    const start = items[0].position.start
    let end = items[items.length - 1].position.end
    list.position.start = start
    list.position.end = end

    const lines: string[] = []
    const walkItem = (item: AnyListItem) => {
        const marker = item.text
        const firstChild = item.blocks.find((b: Block) => b.type === 'paragraph') as any
        const body = firstChild?.text ?? ''
        lines.push(marker + body)

        for (const b of item.blocks) {
            if (b.type === 'list') {
                walkList(b as List)
            }
        }
    }

    const walkList = (l: List) => {
        for (const it of l.blocks as AnyListItem[]) walkItem(it)
    }

    walkList(list)
    list.text = lines.join('\n')
}

function nestListInPlace(list: List) {
    const originalItems = list.blocks as AnyListItem[]
    if (originalItems.length <= 1) return

    const baseIndent = markerIndent(originalItems[0])

    const newTop: AnyListItem[] = []
    list.blocks = newTop as any

    const stack: Array<{ indent: number; list: List }> = [{ indent: 0, list }]

    let lastItemAtLevel: AnyListItem | null = null

    for (const item of originalItems) {
        const rel = Math.max(0, markerIndent(item) - baseIndent)

        while (stack.length > 1 && rel < stack[stack.length - 1].indent) {
            stack.pop()
        }

        if (rel > stack[stack.length - 1].indent) {
            const parentList = stack[stack.length - 1].list
            const parentItem = lastListItem(parentList)

            if (parentItem) {
                const nested = ensureNestedList(parentItem, list)
                stack.push({ indent: rel, list: nested })
            }
        }

        const targetList = stack[stack.length - 1].list
        ;(targetList.blocks as AnyListItem[]).push(item)

        targetList.position.end = Math.max(targetList.position.end, item.position.end)

        lastItemAtLevel = item
    }

    recalcListPositionAndText(list)
}

export function nestLists(blocks: Block[]) {
    const walk = (b: Block) => {
        if ('blocks' in b && Array.isArray((b as any).blocks)) {
            for (const child of (b as any).blocks as Block[]) walk(child)

            if (b.type === 'list') {
                nestListInPlace(b as List)
            }
        }
    }

    for (const b of blocks) walk(b)
}
