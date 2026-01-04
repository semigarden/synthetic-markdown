export default class Caret {
    inlineId = null;
    blockId = null;
    position = null;
    affinity;
    pendingTextRestore = null;
    constructor(inlineId, blockId, position, affinity) {
        this.inlineId = inlineId ?? null;
        this.blockId = blockId ?? null;
        this.position = position ?? null;
        this.affinity = affinity ?? undefined;
    }
    setInlineId(inlineId) {
        this.inlineId = inlineId;
    }
    setBlockId(blockId) {
        this.blockId = blockId;
    }
    setPosition(position) {
        this.position = position;
    }
    setAffinity(affinity) {
        this.affinity = affinity;
    }
    getInlineId() {
        return this.inlineId;
    }
    getBlockId() {
        return this.blockId;
    }
    getPosition() {
        return this.position;
    }
    getAffinity() {
        return this.affinity;
    }
    clear() {
        this.inlineId = null;
        this.blockId = null;
        this.position = null;
        this.affinity = undefined;
    }
    getPositionInInline(inlineEl) {
        const sel = window.getSelection();
        let caretPositionInInline = 0;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const preRange = document.createRange();
            preRange.selectNodeContents(inlineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            caretPositionInInline = preRange.toString().length;
        }
        return caretPositionInInline;
    }
    getPositionInInlines(inlines, inlineId, caretPositionInInline) {
        let charsBeforeEditedInline = 0;
        for (let i = 0; i < inlines.length; i++) {
            if (inlines[i].id === inlineId)
                break;
            charsBeforeEditedInline += inlines[i].text.symbolic.length;
        }
        const caretPositionInInlines = charsBeforeEditedInline + caretPositionInInline;
        return caretPositionInInlines;
    }
    getInlineFromPositionInInlines(inlines, positionInInlines) {
        let inline = null;
        let position = 0;
        let accumulatedLength = 0;
        for (const i of inlines) {
            const textLength = i.text?.symbolic.length ?? 0;
            if (accumulatedLength + textLength >= positionInInlines) {
                inline = i;
                position = positionInInlines - accumulatedLength;
                break;
            }
            accumulatedLength += textLength;
        }
        return {
            inline,
            position
        };
    }
}
