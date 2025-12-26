import React, { useState } from 'react'
import styles from '../styles/SyntheticText.module.scss'
import Inline from './Inline'
import { uuid } from '../utils'

export type InlineType = "text" | "strong" | "em" | "code" | "link" | "image" | "autolink" | "html" | "softbreak" | "hardbreak"

export interface InlineContext {
    id: string
    type: InlineType
    synthetic: string
    pure: string
    start: number,
    end: number,
}

export type BlockType = "paragraph" | "heading" | "block-quote" | "list-item" | "empty";

export interface Block {
    id: string
    type: BlockType
    text: string
    start: number
    end: number
}

const Block: React.FC<{
    className?: string;
    block: Block;
    onBlockEdit?: (block: Block, text: string) => void;
}> = ({
    className = "",
    block,
    onBlockEdit = (block: Block, text: string) => {},
}) => {
    const [text, setText] = useState(block.text)

    const inlines = parseInlines(block.text)

    const onInlineEdit = (inline: InlineContext, text: string) => {
        console.log("onEdit", inline, text)
        const newText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)
        setText(newText)
        onBlockEdit(block, newText)

        console.log("newText", newText)
    }

    return (
        <div className={`${styles.block} ${className}`}
        >
            {inlines.map((inline) => (
                <Inline key={inline.id} inline={inline} onEdit={onInlineEdit} />
            ))}
        </div>
    )
}

export default Block

function parseInlines(text: string): InlineContext[] {
    const inlines: InlineContext[] = [];
    let i = 0;

    while (i < text.length) {
        // 1. Code spans: `code`
        if (text[i] === "`") {
            const end = text.indexOf("`", i + 1);
            if (end !== -1) {
                inlines.push({
                    id: uuid(),
                    type: "code",
                    synthetic: text.slice(i + 1, end),
                    pure: text.slice(i, end + 1),
                    start: i,
                    end: end + 1,
                });
                i = end + 1;
                continue;
            }
        }

        // 2. Bold: **
        if (text.slice(i, i + 2) === "**") {
            const end = text.indexOf("**", i + 2);
            if (end !== -1) {
                inlines.push({
                    id: uuid(),
                    type: "strong",
                    synthetic: text.slice(i + 2, end),
                    pure: text.slice(i, end + 2),
                    start: i,
                    end: end + 2,
                });
                i = end + 2;
                continue;
            }
        }

        // 3. Italic: * (but not part of **)
        if (text[i] === "*" && (i === 0 || text[i - 1] !== "*")) {
            const end = text.indexOf("*", i + 1);
            if (end !== -1 && text.slice(i + 1, end).trim().length > 0) {
                inlines.push({
                    id: uuid(),
                    type: "em",
                    synthetic: text.slice(i + 1, end),
                    pure: text.slice(i, end + 1),
                    start: i,
                    end: end + 1,
                });
                i = end + 1;
                continue;
            }
        }

        let next = text.length;
        for (const delim of ["**", "*", "`"]) {
            const pos = text.indexOf(delim, i + 1);
            if (pos !== -1 && pos < next) {
                next = pos;
            }
        }

        if (next > i) {
            const content = text.slice(i, next);
            if (content.length > 0) {
                inlines.push({
                    id: uuid(),
                    type: "text",
                    synthetic: content,
                    pure: content,
                    start: i,
                    end: next,
                });
            }
            i = next;
        } else {
            i++;
        }
    }

    return inlines;
}
