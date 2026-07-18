import type { Block, LinkReferenceDefinition } from '../../../types'
import type LinkReferenceState from './linkReferenceState'
import { matchLinkReferenceDefinition } from '../block/blockDetect'

function walkBlocks(blocks: Block[], visit: (block: Block) => void) {
    for (const block of blocks) {
        visit(block)
        if ('blocks' in block && Array.isArray(block.blocks)) {
            walkBlocks(block.blocks, visit)
        }
    }
}

function syncLinkReferencesFromBlocks(blocks: Block[], linkReferences: LinkReferenceState) {
    linkReferences.reset()

    walkBlocks(blocks, block => {
        if (block.type !== 'linkReferenceDefinition') return

        const def = block as LinkReferenceDefinition
        const matched = matchLinkReferenceDefinition(String(def.text ?? ''))
        if (matched) {
            def.label = matched.label
            def.url = matched.url
            def.title = matched.title
            linkReferences.set(matched.label, { url: matched.url, title: matched.title })
        } else if (def.label && def.url) {
            linkReferences.set(def.label, { url: def.url, title: def.title })
        }
    })
}

export { syncLinkReferencesFromBlocks }
