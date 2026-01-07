import InlineStream from "./inlineStream"
import { Block, Inline, CodeBlock, TableCell, Paragraph, Delimiter } from "../../types"
import { uuid, decodeHTMLEntity } from "../../utils/utils"

class ParseInline {
    public apply(block: Block): Inline[] {
        const inlines: Inline[] = []
        const text = block.text ?? ''
        const blockId = block.id

        if (text === '') {
            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 },
            })
            return inlines
        }

        if (block.type === 'codeBlock') {
            const codeBlock = block as CodeBlock
            const semantic = codeBlock.isFenced
                ? this.extractFencedCodeContent(text, codeBlock.fence!)
                : text

            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: {
                    symbolic: text,
                    semantic,
                },
                position: {
                    start: 0,
                    end: text.length,
                },
            })

            return inlines
        }

        let parseText = text
        let textOffset = 0

        if (block.type === 'heading') {
            const match = text.match(/^(#{1,6})\s+/)
            if (match) {
                textOffset = match[0].length
                parseText = text.slice(textOffset)
            }
        }

        const newInlines = this.lexInline(
            parseText,
            blockId,
            textOffset
        )

        for (const inline of newInlines) {
            inlines.push({
                ...inline,
                id: uuid(),
                blockId,
            })
        }

        return inlines
    }

    public applyRecursive(block: Block) {
        switch (block.type) {
            case 'paragraph':
            case 'heading':
            case 'codeBlock': {
                block.inlines = this.apply(block)
                return
            }

            default:
                if ('blocks' in block && Array.isArray(block.blocks)) {
                    for (const child of block.blocks) {
                        this.applyRecursive(child)
                    }
                }
        }
    }

    public lexInline(text: string, blockId: string, position: number = 0): Inline[] {
        const stream = new InlineStream(text)
        const result: Inline[] = []
        const delimiterStack: Delimiter[] = []

        let textStart = 0

        const flushText = () => {
            const end = stream.position()
            if (end > textStart) {
                const raw = text.slice(textStart, end)
                result.push({
                    id: uuid(),
                    type: "text",
                    blockId,
                    text: {
                        symbolic: raw,
                        semantic: decodeHTMLEntity(raw),
                    },
                    position: {
                        start: position + textStart,
                        end: position + end,
                    },
                })
            }
            textStart = stream.position()
        }

        while (!stream.end()) {
            const ch = stream.peek()!

            /* ---------------- backslash escapes ---------------- */
            if (stream.consume("\\")) {
                const next = stream.peek()
                if (next) {
                    flushText()
                    stream.next()

                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        text: {
                            symbolic: "\\" + next,
                            semantic: next,
                        },
                        position: {
                            start: position + textStart,
                            end: position + stream.position(),
                        },
                    })
                    textStart = stream.position()
                    continue
                }
            }

            /* ---------------- entity ---------------- */
            if (ch === "&") {
                const checkpoint = stream.checkpoint()
                const remaining = stream.remaining()
                const match = remaining.match(
                    /^&(?:#[xX][0-9a-fA-F]{1,6};|#\d{1,7};|[a-zA-Z][a-zA-Z0-9]{1,31};)/
                )

                if (match) {
                    flushText()
                    stream.consumeString(match[0])

                    result.push({
                        id: uuid(),
                        type: "entity",
                        blockId,
                        text: {
                            symbolic: match[0],
                            semantic: decodeHTMLEntity(match[0]),
                        },
                        position: {
                            start: position + checkpoint,
                            end: position + stream.position(),
                        },
                    } as Inline)

                    textStart = stream.position()
                    continue
                }

                stream.restore(checkpoint)
            }

            /* ---------------- code span ---------------- */
            if (ch === "`") {
                const start = stream.checkpoint()
                let ticks = 0

                while (stream.peek() === "`") {
                    stream.next()
                    ticks++
                }

                const contentStart = stream.position()
                let found = false

                while (!stream.end()) {
                    if (stream.peek() === "`") {
                        let count = 0
                        const mark = stream.checkpoint()
                        while (stream.peek() === "`") {
                            stream.next()
                            count++
                        }

                        if (count === ticks) {
                            const content = text.slice(contentStart, mark)
                                .replace(/\n/g, " ")
                                .replace(/^ (.*) $/, "$1")

                            flushText()

                            result.push({
                                id: uuid(),
                                type: "codeSpan",
                                blockId,
                                text: {
                                    symbolic: text.slice(start, stream.position()),
                                    semantic: content,
                                },
                                position: {
                                    start: position + start,
                                    end: position + stream.position(),
                                },
                            })

                            textStart = stream.position()
                            found = true
                            break
                        }

                        stream.restore(mark)
                    }

                    stream.next()
                }

                if (!found) {
                    stream.restore(start)
                    stream.next()
                }

                continue
            }

            /* ---------------- link ---------------- */
            if (ch === "[") {
                const start = stream.checkpoint()
                const link = this.parseLink(stream, blockId, position)

                if (link) {
                    flushText()
                    result.push(link)
                    textStart = stream.position()
                    continue
                }

                stream.restore(start)
            }

            /* ---------------- emphasis delimiter scan ---------------- */
            if (ch === "*" || ch === "_") {
                flushText()

                const char = stream.next()!
                let count = 1
                while (stream.peek() === char) {
                    stream.next()
                    count++
                }

                const pos = result.length

                result.push({
                    id: uuid(),
                    type: "text",
                    blockId,
                    text: {
                        symbolic: char.repeat(count),
                        semantic: char.repeat(count),
                    },
                    position: {
                        start: position + stream.position() - count,
                        end: position + stream.position(),
                    },
                })

                delimiterStack.push({
                    type: char,
                    length: count,
                    position: pos,
                    canOpen: true,
                    canClose: true,
                    active: true,
                } as Delimiter)

                textStart = stream.position()
                continue
            }

            stream.next()
        }

        flushText()
        this.processEmphasis(delimiterStack, result, blockId)

        return result.length
            ? result
            : [{
                id: uuid(),
                type: "text",
                blockId,
                text: { symbolic: "", semantic: "" },
                position: { start: position, end: position },
            }]
    }

    private parseLink(stream: InlineStream, blockId: string, position: number): Inline | null {
        const start = stream.checkpoint()
        if (!stream.consume("[")) return null

        const labelStart = stream.position()
        while (!stream.end() && stream.peek() !== "]") {
            stream.next()
        }

        if (!stream.consume("]")) {
            stream.restore(start)
            return null
        }

        const label = stream.remaining().slice(
            -(stream.position() - labelStart),
            -1
        )

        if (!stream.consume("(")) {
            stream.restore(start)
            return null
        }

        while (!stream.end() && /\s/.test(stream.peek()!)) stream.next()

        const urlStart = stream.position()
        while (!stream.end() && stream.peek() !== ")") stream.next()
        const url = stream.remaining().slice(
            -(stream.position() - urlStart),
            -1
        )

        if (!stream.consume(")")) {
            stream.restore(start)
            return null
        }

        return {
            id: uuid(),
            type: "link",
            blockId,
            text: {
                symbolic: stream.remaining(),
                semantic: label,
            },
            position: {
                start: position + start,
                end: position + stream.position(),
            },
        } as Inline
    }

    private parseTableRow(line: string): TableCell[] {
        const cellTexts: string[] = []
        let current = ''
        let escaped = false
        let inCode = false
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            
            if (escaped) {
                current += char
                escaped = false
                continue
            }
            
            if (char === "\\") {
                escaped = true
                current += char
                continue
            }
            
            if (char === "`") {
                inCode = !inCode
                current += char
                continue
            }
            
            if (char === "|" && !inCode) {
                cellTexts.push(current)
                current = ''
                continue
            }
            
            current += char
        }
        
        if (current || cellTexts.length > 0) {
            cellTexts.push(current)
        }
        
        if (cellTexts.length > 0 && cellTexts[0].trim() === "") cellTexts.shift()
        if (cellTexts.length > 0 && cellTexts[cellTexts.length - 1].trim() === "") cellTexts.pop()

        let cells: TableCell[] = []
        for (const cellText of cellTexts) {
            const paragraph: Paragraph = {
                id: uuid(),
                type: "paragraph",
                text: cellText,
                position: {
                    start: 0,
                    end: cellText.length,
                },
                inlines: [],
            };

            cells.push({
                id: uuid(),
                type: "tableCell",
                text: cellText,
                position: {
                    start: 0,
                    end: cellText.length,
                },
                blocks: [paragraph],
                inlines: [],
            });
        }
        
        return cells;
    }

    private extractFencedCodeContent(text: string, fence: string): string {
        const lines = text.split("\n");
        if (lines.length <= 1) return "";
        const contentLines = lines.slice(1);
        const closingPattern = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`);
        if (contentLines.length > 0 && closingPattern.test(contentLines[contentLines.length - 1])) {
            contentLines.pop();
        }
        return contentLines.join("\n");
    }

    public parseLinkReferenceDefinitions(text: string) {
        // Match: [label]: url "optional title"
        const refRegex = /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm;
        let match;
        while ((match = refRegex.exec(text)) !== null) {
            const label = match[1].toLowerCase().trim();
            const url = match[2];
            const title = match[3];
            // if (!linkReferences.has(label)) {
            //     linkReferences.set(label, { url, title });
            // }
        }
    }

    private parseImage(text: string, start: number, blockId: string, offset: number): { inline: Inline; end: number } | null {
        // start is at "!"
        if (text[start + 1] !== "[") return null;
        
        // Find matching ]
        let bracketDepth = 1;
        let pos = start + 2;
        while (pos < text.length && bracketDepth > 0) {
            if (text[pos] === "\\") {
                pos += 2;
                continue;
            }
            if (text[pos] === "[") bracketDepth++;
            if (text[pos] === "]") bracketDepth--;
            pos++;
        }
        
        if (bracketDepth !== 0) return null;
        
        const altTextEnd = pos - 1;
        const altText = text.slice(start + 2, altTextEnd);
        
        // Inline image: ![alt](url "title")
        if (pos < text.length && text[pos] === "(") {
            const destResult = this.parseLinkDestinationAndTitle(text, pos);
            if (destResult) {
                const symbolic = text.slice(start, destResult.end);
                return {
                    inline: {
                        id: uuid(),
                        type: "image",
                        blockId,
                        text: {
                            symbolic,
                            semantic: altText,
                        },
                        position: {
                            start: offset + start,
                            end: offset + destResult.end,
                        },
                        url: destResult.url,
                        alt: altText,
                        title: destResult.title,
                    },
                    end: destResult.end,
                };
            }
        }
        
        // Reference image: ![alt][ref] or ![alt][] or ![alt]
        let refLabel = "";
        let refEnd = pos;
        
        if (pos < text.length && text[pos] === "[") {
            const refClosePos = text.indexOf("]", pos + 1);
            if (refClosePos !== -1) {
                refLabel = text.slice(pos + 1, refClosePos).toLowerCase().trim();
                refEnd = refClosePos + 1;
            }
        }
        
        if (refLabel === "") {
            refLabel = altText.toLowerCase().trim();
        }
        
        // const ref = linkReferences.get(refLabel);
        // if (ref) {
        //     return {
        //         inline: {
        //             id: uuid(),
        //             type: "image",
        //             blockId,
        //             text: {
        //                 symbolic: text.slice(start, refEnd),
        //                 semantic: altText,
        //             },
        //             position: {
        //                 start: offset + start,
        //                 end: offset + refEnd,
        //             },
        //             url: ref.url,
        //             alt: altText,
        //             title: ref.title,
        //         },
        //         end: refEnd,
        //     };
        // }
        
        return null;
    }

    private parseLinkDestinationAndTitle(text: string, start: number): { url: string; title?: string; end: number } | null {
        let pos = start;
        if (pos >= text.length || text[pos] !== "(") return null;
        pos++;

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;
        if (pos >= text.length) return null;

        let url = "";
        
        // Angle-bracketed destination
        if (text[pos] === "<") {
            pos++;
            const urlStart = pos;
            while (pos < text.length && text[pos] !== ">" && text[pos] !== "\n") {
                if (text[pos] === "\\") pos++;
                pos++;
            }
            if (pos >= text.length || text[pos] !== ">") return null;
            url = text.slice(urlStart, pos);
            pos++;
        } else {
            // Unbracketed destination - count parentheses
            const urlStart = pos;
            let parenDepth = 0;
            while (pos < text.length) {
                const ch = text[pos];
                if (ch === "\\") {
                    pos += 2;
                    continue;
                }
                if (/[ \t\n]/.test(ch) && parenDepth === 0) break;
                if (ch === "(") {
                    parenDepth++;
                } else if (ch === ")") {
                    if (parenDepth === 0) break;
                    parenDepth--;
                }
                pos++;
            }
            url = text.slice(urlStart, pos);
        }

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;

        // Optional title
        let title: string | undefined;
        if (pos < text.length && (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")) {
            const quoteChar = text[pos];
            const closeChar = quoteChar === "(" ? ")" : quoteChar;
            pos++;
            const titleStart = pos;
            while (pos < text.length && text[pos] !== closeChar) {
                if (text[pos] === "\\") pos++;
                pos++;
            }
            if (pos >= text.length) return null;
            title = text.slice(titleStart, pos);
            pos++;
        }

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;

        // Must end with )
        if (pos >= text.length || text[pos] !== ")") return null;
        pos++;

        return { url, title, end: pos };
    }

    private processEmphasis(stack: Delimiter[], nodes: Inline[], blockId: string) {
        if (stack.length === 0) return;

        let current = 0;

        while (current < stack.length) {
            const closer = stack[current];
            if (!closer.canClose || !closer.active) {
                current++;
                continue;
            }

            let openerIndex = -1;
            for (let i = current - 1; i >= 0; i--) {
                const opener = stack[i];
                if (opener.type !== closer.type || !opener.canOpen || !opener.active) continue;

                if ((opener.length + closer.length) % 3 === 0 &&
                    opener.length !== 1 && closer.length !== 1) {
                    continue;
                }

                openerIndex = i;
                break;
            }

            if (openerIndex === -1) {
                current++;
                continue;
            }

            const opener = stack[openerIndex];
            const useLength = Math.min(opener.length, closer.length, 2);
            const isStrong = useLength === 2;
            const emphType = isStrong ? "strong" : "emphasis";
            const delimChar = opener.type;
            const delimStr = delimChar.repeat(useLength);

            const openerNodeIndex = opener.position;
            const closerNodeIndex = closer.position;

            const startIdx = openerNodeIndex;
            const endIdx = closerNodeIndex + 1;
            const affectedNodes = nodes.slice(startIdx, endIdx);

            let symbolic = delimStr;
            let semantic = '';
            for (const node of affectedNodes.slice(1, -1)) {
                symbolic += node.text.symbolic;
                semantic += node.text.semantic;
            }
            symbolic += delimStr;

            const emphNode: Inline = {
                id: uuid(),
                type: emphType,
                blockId,
                text: {
                    symbolic,
                    semantic,
                },
                position: {
                    start: nodes[openerNodeIndex].position.start,
                    end: nodes[closerNodeIndex].position.end
                },
            };

            const deleteCount = endIdx - startIdx;
            nodes.splice(startIdx, deleteCount, emphNode);

            stack.splice(current, 1);
            stack.splice(openerIndex, 1);

            const removedCount = deleteCount - 1;
            for (let i = 0; i < stack.length; i++) {
                if (stack[i].position >= startIdx + 1) {
                    stack[i].position -= removedCount;
                }
            }

            current = startIdx;
        }
    }
}

export default ParseInline
