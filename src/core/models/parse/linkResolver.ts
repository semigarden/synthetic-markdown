import InlineStream from './inlineStream'
import { Inline } from '../../types'
import { uuid } from '../../utils/utils'

class LinkResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (!stream.consume('[')) return null

        const labelStart = stream.position()
        while (!stream.end() && stream.peek() !== ']') {
            stream.next()
        }

        if (!stream.consume(']')) {
            stream.restore(start)
            return null
        }

        const label = stream.slice(labelStart, stream.position() - 1)

        if (!stream.consume('(')) {
            stream.restore(start)
            return null
        }

        while (!stream.end() && /\s/.test(stream.peek()!)) stream.next()

        const urlStart = stream.position()
        while (!stream.end() && stream.peek() !== ')') stream.next()
        const url = stream.slice(urlStart, stream.position())

        if (!stream.consume(')')) {
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
            url,
        } as Inline
    }
}

export default LinkResolver
