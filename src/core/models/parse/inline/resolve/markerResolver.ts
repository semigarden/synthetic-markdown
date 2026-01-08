import InlineStream from "../inlineStream"
import { Inline } from "../../../../types"
import { uuid } from "../../../../utils/utils"

class MarkerResolver {
    public tryParse(
        stream: InlineStream,
        text: string,
        blockId: string,
        blockType: string,
        position: number
    ): Inline | null {
        if (blockType !== 'heading') return null
        if (stream.position() !== 0) return null

        const match = text.match(/^(#{1,6})(\s+|$)/)
        if (!match) return null

        const markerText = match[1] + (match[2] ? ' ' : '')
        const length = markerText.length

        stream.advance(length)

        return {
            id: uuid(),
            type: 'marker',
            blockId,
            text: { symbolic: markerText, semantic: '' },
            position: {
                start: position,
                end: position + length
            }
        }
    }
}

export default MarkerResolver
