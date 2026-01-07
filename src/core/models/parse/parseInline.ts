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

        const newInlines = this.parseInlineContent(
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

    public parseInlineContent(text: string, blockId: string, position: number = 0): Inline[] {
        const result: Inline[] = [];
        const delimiterStack: Delimiter[] = [];
        let currentPosition = 0;
        let textStart = 0;
        // console.log('parseInlineContent', text, blockId, offset)

        const addText = (start: number, end: number) => {
            if (end > start) {
                const content = text.slice(start, end);
                if (content.length > 0) {
                    const semantic = decodeHTMLEntity(content);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        text: {
                            symbolic: content,
                            semantic,
                        },
                        position: {
                            start: position + start,
                            end: position + end,
                        },
                    });
                }
            }
        };

        const isLeftFlanking = (pos: number, runLength: number): boolean => {
            const afterRun = pos + runLength;
            if (afterRun >= text.length) return false;
            const charAfter = text[afterRun];
            const charBefore = pos > 0 ? text[pos - 1] : ' ';
            
            // Not followed by whitespace
            if (/\s/.test(charAfter)) return false;
            // Not followed by punctuation OR preceded by whitespace/punctuation
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter)) {
                return /\s/.test(charBefore) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore);
            }
            return true;
        };

        const isRightFlanking = (pos: number, runLength: number): boolean => {
            if (pos === 0) return false;
            const charBefore = text[pos - 1];
            const charAfter = pos + runLength < text.length ? text[pos + runLength] : ' ';
            
            // Not preceded by whitespace
            if (/\s/.test(charBefore)) return false;
            // Not preceded by punctuation OR followed by whitespace/punctuation
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore)) {
                return /\s/.test(charAfter) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter);
            }
            return true;
        };

        while (currentPosition < text.length) {
            // Backslash escapes
            if (text[currentPosition] === "\\" && currentPosition + 1 < text.length) {
                const escaped = text[currentPosition + 1];
                if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(escaped)) {
                    addText(textStart, currentPosition);
                    const symbolic = text.slice(currentPosition, currentPosition + 2);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        text: { symbolic, semantic: escaped },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + 2,
                        },
                    });
                    currentPosition += 2;
                    textStart = currentPosition;
                    continue;
                }
                if (escaped === "\n") {
                    addText(textStart, currentPosition);
                    result.push({
                        id: uuid(),
                        type: "hardBreak",
                        blockId,
                        text: {
                            symbolic: "\\\n",
                            semantic: "\n",
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + 2,
                        },
                    });
                    currentPosition += 2;
                    textStart = currentPosition;
                    continue;
                }
            }

            // Entity references
            if (text[currentPosition] === "&") {
                const entityMatch = text.slice(currentPosition).match(/^&(?:#[xX]([0-9a-fA-F]{1,6});|#(\d{1,7});|([a-zA-Z][a-zA-Z0-9]{1,31});)/);
                if (entityMatch) {
                    addText(textStart, currentPosition);
                    const entityRaw = entityMatch[0];
                    const decoded = decodeHTMLEntity(entityRaw);
                    result.push({
                        id: uuid(),
                        type: "entity",
                        blockId,
                        text: {
                            symbolic: entityRaw,
                            semantic: decoded,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + entityRaw.length,
                        },
                        decoded,
                    });
                    currentPosition += entityRaw.length;
                    textStart = currentPosition;
                    continue;
                }
            }

            // Code spans - variable backtick counts
            if (text[currentPosition] === "`") {
                addText(textStart, currentPosition);
                let backtickCount = 1;
                while (currentPosition + backtickCount < text.length && text[currentPosition + backtickCount] === "`") {
                    backtickCount++;
                }

                // Search for matching closing backticks
                let searchPosition = currentPosition + backtickCount;
                let found = false;
                while (searchPosition < text.length) {
                    if (text[searchPosition] === "`") {
                        let closeCount = 1;
                        while (searchPosition + closeCount < text.length && text[searchPosition + closeCount] === "`") {
                            closeCount++;
                        }
                        if (closeCount === backtickCount) {
                            // Extract code content, normalize line endings, collapse spaces
                            let codeContent = text.slice(currentPosition + backtickCount, searchPosition);
                            codeContent = codeContent.replace(/\n/g, " ");
                            // Strip one leading/trailing space if content starts AND ends with space
                            if (codeContent.length > 0 && codeContent[0] === " " && codeContent[codeContent.length - 1] === " " && codeContent.trim().length > 0) {
                                codeContent = codeContent.slice(1, -1);
                            }
                            
                            const symbolic = text.slice(currentPosition, searchPosition + backtickCount);
                            result.push({
                                id: uuid(),
                                type: "codeSpan",
                                blockId,
                                text: { symbolic, semantic: codeContent },
                                position: {
                                    start: position + currentPosition,
                                    end: position + searchPosition + backtickCount,
                                },
                            });
                            currentPosition = searchPosition + backtickCount;
                            textStart = currentPosition;
                            found = true;
                            break;
                        }
                        searchPosition += closeCount;
                    } else {
                        searchPosition++;
                    }
                }
                
                if (!found) {
                    const backtickText = "`".repeat(backtickCount);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        text: {
                            symbolic: backtickText,
                            semantic: backtickText,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + backtickCount,
                        },
                    });
                    currentPosition += backtickCount;
                    textStart = currentPosition;
                }
                continue;
            }

            // Autolinks
            if (text[currentPosition] === "<") {
                const autolinkMatch = text.slice(currentPosition).match(/^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/);
                if (autolinkMatch) {
                    addText(textStart, currentPosition);
                    const url = autolinkMatch[1];
                    result.push({
                        id: uuid(),
                        type: "autolink",
                        blockId,
                        text: {
                            symbolic: autolinkMatch[0],
                            semantic: url,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + autolinkMatch[0].length,
                        },
                        url,
                    });
                    currentPosition += autolinkMatch[0].length;
                    textStart = currentPosition;
                    continue;
                }

                const emailMatch = text.slice(currentPosition).match(/^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/);
                if (emailMatch) {
                    addText(textStart, currentPosition);
                    const email = emailMatch[1];
                    const url = "mailto:" + email;
                    result.push({
                        id: uuid(),
                        type: "autolink",
                        blockId,
                        text: {
                            symbolic: emailMatch[0],
                            semantic: email,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + emailMatch[0].length,
                        },
                        url,
                    });
                    currentPosition += emailMatch[0].length;
                    textStart = currentPosition;
                    continue;
                }

                const htmlMatch = text.slice(currentPosition).match(/^<(\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|!--[\s\S]*?-->|!\[CDATA\[[\s\S]*?\]\]>|\?[^>]*\?>|![A-Z]+[^>]*>)/);
                if (htmlMatch) {
                    addText(textStart, currentPosition);
                    const html = htmlMatch[0];
                    result.push({
                        id: uuid(),
                        type: "rawHTML",
                        blockId,
                        text: {
                            symbolic: html,
                            semantic: html,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + html.length,
                        },
                    });
                    currentPosition += html.length;
                    textStart = currentPosition;
                    continue;
                }
            }

            if (text[currentPosition] === "!" && currentPosition + 1 < text.length && text[currentPosition + 1] === "[") {
                const imageResult = this.parseImage(text, currentPosition, blockId, position);
                if (imageResult) {
                    addText(textStart, currentPosition);
                    result.push(imageResult.inline);
                    currentPosition = imageResult.end;
                    textStart = currentPosition;
                    continue;
                }
            }

            if (text[currentPosition] === "[") {
                const linkResult = this.parseLink(text, currentPosition, blockId, position);
                if (linkResult) {
                    addText(textStart, currentPosition);
                    result.push(linkResult.inline);
                    currentPosition = linkResult.end;
                    textStart = currentPosition;
                    continue;
                }
            }

            // Footnote references [^label]
            if (text[currentPosition] === "[" && currentPosition + 1 < text.length && text[currentPosition + 1] === "^") {
                const footnoteMatch = text.slice(currentPosition).match(/^\[\^([^\]]+)\]/);
                if (footnoteMatch) {
                    addText(textStart, currentPosition);
                    const label = footnoteMatch[1];
                    result.push({
                        id: uuid(),
                        type: "footnoteRef",
                        blockId,
                        text: {
                            symbolic: footnoteMatch[0],
                            semantic: label,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + footnoteMatch[0].length,
                        },
                        label,
                    });
                    currentPosition += footnoteMatch[0].length;
                    textStart = currentPosition;
                    continue;
                }
            }

            // Strikethrough ~~
            if (text[currentPosition] === "~" && currentPosition + 1 < text.length && text[currentPosition + 1] === "~") {
                let tildeCount = 2;
                while (currentPosition + tildeCount < text.length && text[currentPosition + tildeCount] === "~") {
                    tildeCount++;
                }
                
                if (tildeCount === 2) {
                    const closePos = text.indexOf("~~", currentPosition + 2);
                    if (closePos !== -1) {
                        addText(textStart, currentPosition);
                        const innerText = text.slice(currentPosition + 2, closePos);
                        const symbolic = text.slice(currentPosition, closePos + 2);
                        result.push({
                            id: uuid(),
                            type: "strikethrough",
                            blockId,
                            text: {
                                symbolic,
                                semantic: innerText,
                            },
                            position: {
                                start: position + currentPosition,
                                end: position + closePos + 2,
                            },
                        });
                        currentPosition = closePos + 2;
                        textStart = currentPosition;
                        continue;
                    }
                }
            }

            // Emphasis * and _
            if (text[currentPosition] === "*" || text[currentPosition] === "_") {
                const delimChar = text[currentPosition] as "*" | "_";
                let runLength = 1;
                while (currentPosition + runLength < text.length && text[currentPosition + runLength] === delimChar) {
                    runLength++;
                }

                const leftFlanking = isLeftFlanking(currentPosition, runLength);
                const rightFlanking = isRightFlanking(currentPosition, runLength);

                // For *, can open if left-flanking
                // For _, can open if left-flanking and (not right-flanking OR preceded by punctuation)
                let canOpen = leftFlanking;
                let canClose = rightFlanking;

                if (delimChar === "_") {
                    const charBefore = currentPosition > 0 ? text[currentPosition - 1] : ' ';
                    const charAfter = currentPosition + runLength < text.length ? text[currentPosition + runLength] : ' ';
                    canOpen = leftFlanking && (!rightFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore));
                    canClose = rightFlanking && (!leftFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter));
                }

                if (canOpen || canClose) {
                    addText(textStart, currentPosition);
                    const delimText = delimChar.repeat(runLength);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        text: {
                            symbolic: delimText,
                            semantic: delimText,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + runLength,
                        },
                    });

                    delimiterStack.push({
                        type: delimChar,
                        length: runLength,
                        position: result.length - 1,
                        canOpen,
                        canClose,
                        active: true,
                    });

                    textStart = currentPosition + runLength;
                }

                currentPosition += runLength;
                continue;
            }

            // // Hard line break: two+ spaces at end of line followed by newline
            // if (text[pos] === " ") {
            //     let spaceCount = 1;
            //     while (pos + spaceCount < text.length && text[pos + spaceCount] === " ") {
            //         spaceCount++;
            //     }
            //     if (spaceCount >= 2 && pos + spaceCount < text.length && text[pos + spaceCount] === "\n") {
            //         addText(textStart, pos);
            //         const symbolic = " ".repeat(spaceCount) + "\n";
            //         result.push({
            //             id: uuid(),
            //             type: "hardBreak",
            //             blockId,
            //             text: {
            //                 symbolic,
            //                 semantic: "\n",
            //             },
            //             position: {
            //                 start: offset + pos,
            //                 end: offset + pos + spaceCount + 1,
            //             },
            //         });
            //         pos += spaceCount + 1;
            //         textStart = pos;
            //         continue;
            //     }
            // }

            // if (text[pos] === "\n") {
            //     addText(textStart, pos);
            //     result.push({
            //         id: uuid(),
            //         type: "softBreak",
            //         blockId,
            //         text: {
            //             symbolic: "\n",
            //             semantic: "\n",
            //         },
            //         position: {
            //             start: offset + pos,
            //             end: offset + pos + 1,
            //         },
            //     });
            //     pos++;
            //     textStart = pos;
            //     continue;
            // }

            if (text[currentPosition] === ":") {
                const emojiMatch = text.slice(currentPosition).match(/^:([a-zA-Z0-9_+-]+):/);
                if (emojiMatch) {
                    addText(textStart, currentPosition);
                    const name = emojiMatch[1];
                    const symbolic = emojiMatch[0];
                    result.push({
                        id: uuid(),
                        type: "emoji",
                        blockId,
                        text: {
                            symbolic,
                            semantic: symbolic,
                        },
                        position: {
                            start: position + currentPosition,
                            end: position + currentPosition + symbolic.length,
                        },
                        name,
                    });
                    currentPosition += symbolic.length;
                    textStart = currentPosition;
                    continue;
                }
            }

            currentPosition++;
        }

        addText(textStart, currentPosition);

        this.processEmphasis(delimiterStack, result, blockId);

        if (result.length === 0) {
            result.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: position, end: position },
            });
        }

        return result;
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

    private parseLink(text: string, start: number, blockId: string, offset: number): { inline: Inline; end: number } | null {
        // Find matching ]
        let bracketDepth = 1;
        let pos = start + 1;
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
        
        const linkTextEnd = pos - 1;
        const linkText = text.slice(start + 1, linkTextEnd);
        
        // Inline link: [text](url "title")
        if (pos < text.length && text[pos] === "(") {
            const destResult = this.parseLinkDestinationAndTitle(text, pos);
            if (destResult) {
                const symbolic = text.slice(start, destResult.end);
                return {
                    inline: {
                        id: uuid(),
                        type: "link",
                        blockId,
                        text: {
                            symbolic,
                            semantic: linkText,
                        },
                        position: {
                            start: offset + start,
                            end: offset + destResult.end,
                        },
                        url: destResult.url,
                        title: destResult.title,
                    },
                    end: destResult.end,
                };
            }
        }
        
        // Reference link: [text][ref] or [text][] or [text]
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
            refLabel = linkText.toLowerCase().trim();
        }
        
        // const ref = linkReferences.get(refLabel);
        // if (ref) {
        //     return {
        //         inline: {
        //             id: uuid(),
        //             type: "link",
        //             blockId,
        //             text: {
        //                 symbolic: text.slice(start, refEnd),
        //                 semantic: linkText,
        //             },
        //             position: {
        //                 start: offset + start,
        //                 end: offset + refEnd,
        //             },
        //             url: ref.url,
        //             title: ref.title,
        //         },
        //         end: refEnd,
        //     };
        // }
        
        return null;
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
