import InlineStream from '../inlineStream'
import { Inline, Delimiter } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class DelimiterResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        positionOffset: number,
        result: Inline[],
        delimiterStack: Delimiter[]
    ): boolean {
        const ch = stream.peek()
        if (ch !== '*' && ch !== '_' && ch !== '~') return false

        const start = stream.position()
        const char = stream.next()!
        let count = 1

        const prev = stream.peekBack() ?? null
        const next = stream.peek() ?? null

        const leftFlanking =
        !this.isWhitespace(next) &&
        !(this.isPunctuation(next) && !this.isWhitespace(prev) && !this.isPunctuation(prev))

        const rightFlanking =
        !this.isWhitespace(prev) &&
        !(this.isPunctuation(prev) && !this.isWhitespace(next) && !this.isPunctuation(next))

        const canOpen =
            char === '_' ? leftFlanking && (!rightFlanking || this.isPunctuation(prev)) : leftFlanking

        const canClose =
            char === '_' ? rightFlanking && (!leftFlanking || this.isPunctuation(next)) : rightFlanking

        while (stream.peek() === char) {
            stream.next()
            count++
        }

        const inlinePos = result.length

        result.push({
            id: uuid(),
            type: 'text',
            blockId,
            text: {
                symbolic: char.repeat(count),
                semantic: char.repeat(count),
            },
            position: {
                start: positionOffset + start,
                end: positionOffset + stream.position(),
            },
        })

        delimiterStack.push({
            type: char,
            length: count,
            position: inlinePos,
            canOpen,
            canClose,
            active: true,
        } as Delimiter)

        return true
    }

    private isWhitespace(ch: string | null) {
        return ch === null || /\s/.test(ch)
    }

    private isPunctuation(ch: string | null) {
        return ch !== null && /[!-/:-@[-`{-~]/.test(ch)
    }
}

export default DelimiterResolver
