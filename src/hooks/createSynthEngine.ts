import { uuid } from "../utils";

interface BlockType<T extends string = string> {
    id: string
    type: T
    text: string
    start: number
    end: number
}

export type Block =
    | Document
    | Paragraph
    | Heading
    | BlockQuote
    | CodeBlock
    | List
    | ListItem
    | ThematicBreak
    | Table
    | TableRow
    | TableCell
    | HTMLBlock
    | Footnote
    | TaskListItem

interface Document extends BlockType<'document'> {
    children: Block[]
}

interface Paragraph extends BlockType<'paragraph'> {
}

interface Heading extends BlockType<'heading'> {    start: number
    level: number
}

interface BlockQuote extends BlockType<'blockQuote'> {
}

interface CodeBlock extends BlockType<'codeBlock'> {
}

interface List extends BlockType<'list'> {
    ordered: boolean
    children: ListItem[]
}

interface ListItem extends BlockType<'listItem'> {
}

interface ThematicBreak extends BlockType<'thematicBreak'> {
}

interface Table extends BlockType<'table'> {
    children: TableRow[]
}

interface TableRow extends BlockType<'tableRow'> {
    children: TableCell[]
}

interface TableCell extends BlockType<'tableCell'> {
}

interface HTMLBlock extends BlockType<'htmlBlock'> {
}

interface Footnote extends BlockType<'footnote'> {
}

interface TaskListItem extends BlockType<'taskListItem'> {
}


interface InlineType<T extends string = string> {
    id: string
    blockId: string
    type: T
    synthetic: string
    pure: string
    start: number
    end: number
}

export type Inline =
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Autolink
    | Image
    | Strikethrough
    | FootnoteRef
    | Emoji
    | SoftBreak
    | HardBreak

interface Text extends InlineType<'text'> {
}

interface Emphasis extends InlineType<'emphasis'> {
}

interface Strong extends InlineType<'strong'> {
}

interface CodeSpan extends InlineType<'codeSpan'> {
}

interface Link extends InlineType<'link'> {
    url: string
    title?: string
    children: Inline[]
}

interface Autolink extends InlineType<'autolink'> {
    url: string
}

interface Image extends InlineType<'image'> {
    url: string
    alt: string
    title?: string
    children: Inline[]
}

interface Strikethrough extends InlineType<'strikethrough'> {
    children: Inline[]
}

interface FootnoteRef extends InlineType<'footnoteRef'> {
    id: string
}

interface Emoji extends InlineType<'emoji'> {
    name: string
}

interface SoftBreak extends InlineType<'softBreak'> {
}

interface HardBreak extends InlineType<'hardBreak'> {
}

interface DetectedBlock {
    type: Block["type"];
    // extra fields depending on type
    level?: number;
    ordered?: boolean;
}

export function createSynthEngine() {
    let sourceText = "";
    let blocks: Block[] = [];
    let inlines = new Map<string, Inline[]>();

    function sync(nextText: string) {
        if (sourceText.length > 0 && nextText === sourceText) return;
    
        const prevBlocks = blocks;
        const lines = nextText.split("\n");
        let offset = 0;
        const nextBlocks: Block[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const start = offset;
            const end = i === lines.length - 1 ? nextText.length : offset + line.length + 1;
            const detectedBlock = detectType(line);

            const prevBlock = prevBlocks.find(b => b.start === start && b.type === detectedBlock.type);
            const blockId = prevBlock?.id ?? uuid();

            let block: Block;

            switch (detectedBlock.type) {
                case "heading":
                    block = {
                        id: blockId,
                        type: "heading",
                        level: detectedBlock.level!,
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "blockQuote":
                    block = {
                        id: blockId,
                        type: "blockQuote",
                        text: line.replace(/^>\s?/, ""),
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "listItem":
                    const listItem: ListItem = {
                        id: blockId,
                        type: "listItem",
                        text: line.replace(/^(\s*([-*+]|(\d+\.))\s+)/, ""),
                        start,
                        end,
                    };

                    // find existing list at same indent
                    const lastBlock = nextBlocks[nextBlocks.length - 1];
                    if (lastBlock && lastBlock.type === "list" && (lastBlock as List).ordered === detectedBlock.ordered) {
                        (lastBlock as List).children.push(listItem);
                    } else {
                        const newList: List = {
                            id: blockId,
                            type: "list",
                            text: "", // list itself has no text
                            start,
                            end,
                            ordered: detectedBlock.ordered ?? false,
                            children: [listItem],
                        };
                        nextBlocks.push(newList);
                    }
                    break;

                case "taskListItem":
                    block = {
                        id: blockId,
                        type: "taskListItem",
                        text: line.replace(/^(\s*([-*+])\s+\[[ xX]\]\s+)/, ""),
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "thematicBreak":
                    block = {
                        id: blockId,
                        type: "thematicBreak",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "codeBlock":
                    block = {
                        id: blockId,
                        type: "codeBlock",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "table":
                    const table: Table = {
                        id: blockId,
                        type: "table",
                        text: "", // table container has no direct text
                        start,
                        end,
                        children: [],
                    };
                    const row: TableRow = {
                        id: blockId,
                        type: "tableRow",
                        text: line,
                        start,
                        end,
                        children: line.split("|").map((cellText, idx) => ({
                            id: blockId,
                            type: "tableCell",
                            text: cellText.trim(),
                            start,
                            end,
                        })),
                    };
                    table.children.push(row);
                    nextBlocks.push(table);
                    break;

                case "footnote":
                    block = {
                        id: blockId,
                        type: "footnote",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "htmlBlock":
                    block = {
                        id: blockId,
                        type: "htmlBlock",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "paragraph":
                default:
                    block = {
                        id: blockId,
                        type: "paragraph",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;
            }

            offset = end + 1;
        }

        if (sourceText.length === 0 && (nextBlocks.length === 0 || nextBlocks[nextBlocks.length - 1].text !== "")) {
            const emptyBlock: Paragraph = {
                id: uuid(),
                type: "paragraph",
                text: "",
                start: nextText.length,
                end: nextText.length,
            };
            nextBlocks.push(emptyBlock);
            
        }

        const newBlockIds = new Set(nextBlocks.map(b => b.id));
        for (const oldId of inlines.keys()) {
            if (!newBlockIds.has(oldId)) {
                inlines.delete(oldId);
            }
        }

        blocks = nextBlocks;
        sourceText = nextText;

        console.log("blocks", JSON.stringify(blocks, null, 2));

        const lastBlock = blocks[blocks.length - 1];
        if (!inlines.has(lastBlock.id)) {
            parseInlines(lastBlock);
        }
    }

    function detectType(line: string): DetectedBlock {
        const trimmed = line.trim();

        // Empty line -> paragraph
        if (trimmed === "") return { type: "paragraph" };

        // Heading: # H1, ## H2, etc.
        const headingMatch = trimmed.match(/^(#{1,6})\s+/);
        if (headingMatch) {
            return { type: "heading", level: headingMatch[1].length };
        }

        // Blockquote: > quote
        if (trimmed.startsWith("> ")) {
            return { type: "blockQuote" };
        }

        // Thematic break: --- or *** or ___
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            return { type: "thematicBreak" };
        }

        // Fenced code block: ``` or ~~~
        if (/^(```|~~~)/.test(trimmed)) {
            return { type: "codeBlock" };
        }

        // List item: unordered (-, *, +)
        const unorderedListMatch = /^\s*([-*+])\s+/.exec(line);
        if (unorderedListMatch) {
            return { type: "listItem", ordered: false };
        }

        // List item: ordered (1. 2. etc.)
        const orderedListMatch = /^\s*(\d+)\.\s+/.exec(line);
        if (orderedListMatch) {
            return { type: "listItem", ordered: true };
        }

        // Task list item: - [ ] or - [x]
        const taskListMatch = /^\s*[-*+]\s+\[( |x|X)\]\s+/.exec(line);
        if (taskListMatch) {
            return { type: "taskListItem", ordered: false };
        }

        // Table row: line contains at least one |
        if (trimmed.includes("|")) {
            return { type: "table" };
        }

        // Footnote: [^1]: text
        if (/^\[\^.+\]:/.test(trimmed)) {
            return { type: "footnote" };
        }

        // HTML block: starts with <tag>
        if (/^<\w+/.test(trimmed)) {
            return { type: "htmlBlock" };
        }

        // Default fallback -> paragraph
        return { type: "paragraph" };
    }

    function parseInlines(block: Block): Inline[] {
        const next: Inline[] = [];
        let i = 0;
        const text = block.text;

        if (text === "") {
            const emptyInline: Inline = {
                id: uuid(),
                type: "text",
                blockId: block.id,
                synthetic: "",
                pure: "",
                start: 0,
                end: 0,
            };
            next.push(emptyInline);
            inlines.set(block.id, next);
            return next;
        }

        let loopIndex = 0;
        while (i < text.length) {
            if (++loopIndex > 1000) {
                console.error("Potential infinite loop detected", JSON.stringify(text, null, 2))
                break;
            }

            let matched = false;

            // `code`
            if (text[i] === "`") {
                const end = text.indexOf("`", i + 1);
                if (end !== -1) {
                    next.push({
                        id: uuid(),
                        type: "codeSpan",
                        blockId: block.id,
                        synthetic: text.slice(i, end + 1),
                        pure: text.slice(i + 1, end),
                        start: i,
                        end: end + 1,
                    });
                    i = end + 1;
                    matched = true;
                }
            }
        
            // strong **
            if (!matched && text.slice(i, i + 2) === "**") {
                const end = text.indexOf("**", i + 2);
                if (end !== -1) {
                    next.push({
                        id: uuid(),
                        type: "strong",
                        blockId: block.id,
                        synthetic: text.slice(i, end + 2),
                        pure: text.slice(i + 2, end),
                        start: i,
                        end: end + 2,
                    });
                    i = end + 2;
                } else {
                    next.push({
                        id: uuid(),
                        type: "text",
                        blockId: block.id,
                        synthetic: "**",
                        pure: "**",
                        start: i,
                        end: i + 2,
                    });
                    i += 2;
                }
                matched = true;
            }
        
            // em *
            if (!matched && text[i] === "*" && (i + 1 >= text.length || text[i + 1] !== "*")) {
                const end = text.indexOf("*", i + 1);
                if (end !== -1) {
                    const inner = text.slice(i + 1, end);
                    if (!inner.includes("*")) {
                        next.push({
                            id: uuid(),
                            type: "emphasis",
                            blockId: block.id,
                            synthetic: text.slice(i, end + 1),
                            pure: inner,
                            start: i,
                            end: end + 1,
                        });
                        i = end + 1;
                    } else {
                        next.push({
                            id: uuid(),
                            type: "text",
                            blockId: block.id,
                            synthetic: "*",
                            pure: "*",
                            start: i,
                            end: i + 1,
                        });
                        i += 1;
                    }
                } else {
                    next.push({
                        id: uuid(),
                        type: "text",
                        blockId: block.id,
                        synthetic: "*",
                        pure: "*",
                        start: i,
                        end: i + 1,
                    });
                    i += 1;
                }
                matched = true;
            }
            
            // plain text
            if (!matched) {
                let nextDelim = text.length;
                for (const d of ["**", "*", "`"]) {
                    const p = text.indexOf(d, i);
                    if (p !== -1 && p < nextDelim) nextDelim = p;
                }
                const content = text.slice(i, nextDelim);
                next.push({
                    id: uuid(),
                    type: "text",
                    blockId: block.id,
                    synthetic: content,
                    pure: content,
                    start: i,
                    end: nextDelim,
                });
                i = nextDelim;
            }
        }

        inlines.set(block.id, next);
        return next;
    }


    function getBlocks() {
        return blocks;
    }
    
    function getInlines(block: Block) {
        let current = inlines.get(block.id);
        if (!current || current.length === 0) {
            current = parseInlines(block);
        }
        return current;
    }
    
    function applyInlineEdit(inline: Inline, nextPureText: string): string {
        const block = blocks.find(b => b.id === inline.blockId)!;
        const blockInlines = inlines.get(block.id)!;

        let newSynthetic: string;
        switch (inline.type) {
            case "strong":
                newSynthetic = `**${nextPureText}**`;
                break;
            case "emphasis":
                newSynthetic = `*${nextPureText}*`;
                break;
            case "codeSpan":
                newSynthetic = `\`${nextPureText}\``;
                break;
            case "text":
            default:
                newSynthetic = nextPureText;
                break;
        }

        const oldLength = inline.end - inline.start;
        const newLength = newSynthetic.length;
        const delta = newLength - oldLength;

        const globalStart = block.start + inline.start;
        const globalEnd = block.start + inline.end;

        const newSourceText =
        sourceText.slice(0, globalStart) +
        newSynthetic +
        sourceText.slice(globalEnd);

        inline.pure = nextPureText;
        inline.synthetic = newSynthetic;
        inline.end += delta;

        const inlineIndex = blockInlines.findIndex(i => i.id === inline.id);
        for (let i = inlineIndex + 1; i < blockInlines.length; i++) {
            blockInlines[i].start += delta;
            blockInlines[i].end += delta;
        }

        sourceText = newSourceText;

        return newSourceText;
    }

    return {
        get blocks() {
            return blocks;
        },
        get sourceText() {
            return sourceText;
        },
        sync,
        getBlocks,
        getInlines,
        applyInlineEdit,
    };
}

export type SynthEngine = ReturnType<typeof createSynthEngine>;
