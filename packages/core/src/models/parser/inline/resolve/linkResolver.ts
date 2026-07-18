import InlineStream from '../inlineStream'
import { parseLinkDestination } from '../parseLinkDestination'
import type LinkReferenceState from '../../ast/linkReferenceState'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class LinkResolver {
    constructor(private linkReferences: LinkReferenceState) {}

    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()
        if (!stream.consume('[')) return null

        const textStart = stream.position()
        while (!stream.end() && stream.peek() !== ']') {
            stream.next()
        }

        if (!stream.consume(']')) {
            stream.restore(start)
            return null
        }

        const label = stream.slice(textStart, stream.position() - 1)

        // Inline: [text](url)
        const dest = parseLinkDestination(stream)
        if (dest) {
            return {
                id: uuid(),
                type: 'link',
                blockId,
                text: {
                    symbolic: stream.slice(start, stream.position()),
                    semantic: label,
                },
                position: {
                    start: position + start,
                    end: position + stream.position(),
                },
                url: dest.url,
                title: dest.title,
            } as Inline
        }

        // Full / collapsed reference: [text][ref] or [text][]
        if (stream.peek() === '[') {
            stream.next()
            const refStart = stream.position()
            while (!stream.end() && stream.peek() !== ']') {
                stream.next()
            }
            if (!stream.consume(']')) {
                stream.restore(start)
                return null
            }

            const refRaw = stream.slice(refStart, stream.position() - 1)
            const refKey = (refRaw.length === 0 ? label : refRaw).toLowerCase().trim()
            const ref = this.linkReferences.get(refKey)
            if (!ref) {
                stream.restore(start)
                return null
            }

            return {
                id: uuid(),
                type: 'link',
                blockId,
                text: {
                    symbolic: stream.slice(start, stream.position()),
                    semantic: label,
                },
                position: {
                    start: position + start,
                    end: position + stream.position(),
                },
                url: ref.url,
                title: ref.title,
                reference: refKey,
            } as Inline
        }

        // Shortcut reference: [text] when a matching definition exists
        const next = stream.peek()
        if (next !== '[' && next !== '(') {
            const refKey = label.toLowerCase().trim()
            const ref = this.linkReferences.get(refKey)
            if (ref) {
                return {
                    id: uuid(),
                    type: 'link',
                    blockId,
                    text: {
                        symbolic: stream.slice(start, stream.position()),
                        semantic: label,
                    },
                    position: {
                        start: position + start,
                        end: position + stream.position(),
                    },
                    url: ref.url,
                    title: ref.title,
                    reference: refKey,
                } as Inline
            }
        }

        stream.restore(start)
        return null
    }
}

export default LinkResolver
