import InlineStream from '../inlineStream'
import { parseLinkDestination } from '../parseLinkDestination'
import type LinkReferenceState from '../../ast/linkReferenceState'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class ImageResolver {
    constructor(private linkReferences: LinkReferenceState) {}

    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (!stream.consume('!')) return null
        if (!stream.consume('[')) {
            stream.restore(start)
            return null
        }

        const altStart = stream.position()
        while (!stream.end() && stream.peek() !== ']') {
            stream.next()
        }

        if (!stream.consume(']')) {
            stream.restore(start)
            return null
        }

        const alt = stream.slice(altStart, stream.position() - 1)

        const dest = parseLinkDestination(stream)
        if (dest) {
            return {
                id: uuid(),
                type: 'image',
                blockId,
                text: {
                    symbolic: stream.slice(start, stream.position()),
                    semantic: alt,
                },
                position: {
                    start: position + start,
                    end: position + stream.position(),
                },
                url: dest.url,
                title: dest.title,
                alt,
            } as Inline
        }

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
            const refKey = (refRaw.length === 0 ? alt : refRaw).toLowerCase().trim()
            const ref = this.linkReferences.get(refKey)
            if (!ref) {
                stream.restore(start)
                return null
            }

            return {
                id: uuid(),
                type: 'image',
                blockId,
                text: {
                    symbolic: stream.slice(start, stream.position()),
                    semantic: alt,
                },
                position: {
                    start: position + start,
                    end: position + stream.position(),
                },
                url: ref.url,
                title: ref.title,
                alt,
                reference: refKey,
            } as Inline
        }

        const next = stream.peek()
        if (next !== '[' && next !== '(') {
            const refKey = alt.toLowerCase().trim()
            const ref = this.linkReferences.get(refKey)
            if (ref) {
                return {
                    id: uuid(),
                    type: 'image',
                    blockId,
                    text: {
                        symbolic: stream.slice(start, stream.position()),
                        semantic: alt,
                    },
                    position: {
                        start: position + start,
                        end: position + stream.position(),
                    },
                    url: ref.url,
                    title: ref.title,
                    alt,
                    reference: refKey,
                } as Inline
            }
        }

        stream.restore(start)
        return null
    }
}

export default ImageResolver
