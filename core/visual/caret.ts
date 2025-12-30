export default class Caret {
    private inlineId: string | null = null
    private blockId: string | null = null
    private position: number | null = null
    private affinity?: 'start' | 'end'

    constructor(inlineId?: string, blockId?: string, position?: number, affinity?: 'start' | 'end') {
        this.inlineId = inlineId ?? null
        this.blockId = blockId ?? null
        this.position = position ?? null
        this.affinity = affinity ?? undefined
    }

    setInlineId(inlineId: string) {
        this.inlineId = inlineId
    }

    setBlockId(blockId: string) {
        this.blockId = blockId
    }

    setPosition(position: number) {
        this.position = position
    }

    setAffinity(affinity?: 'start' | 'end') {
        this.affinity = affinity
    }

    getInlineId() {
        return this.inlineId
    }

    getBlockId() {
        return this.blockId
    }
    
    getPosition() {
        return this.position
    }

    getAffinity() {
        return this.affinity
    }

    clear() {
        this.inlineId = null
        this.blockId = null
        this.position = null
        this.affinity = undefined
    }
}
