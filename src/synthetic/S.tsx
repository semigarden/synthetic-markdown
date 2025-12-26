import React, { useState } from 'react'
import styles from '../styles/Synth.module.scss'
import { uuid } from '../utils'
import Block from './Block'

export type BlockType = "paragraph" | "heading" | "block-quote" | "list-item" | "empty";

export interface BlockContext {
    id: string
    type: BlockType
    text: string
    start: number
    end: number
}

const SyntheticText: React.FC<{
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void;
}> = ({
    className = "",
    value,
    onChange = () => {},
}) => {
    const blocks = parseBlocks(value)

    // console.log("blocks", value, JSON.stringify(blocks, null, 2))

    const onBlockEdit = (block: BlockContext, text: string) => {
        const newText = value.slice(0, block.start) + text + value.slice(block.end)
        const event = {
            target: {
                value: newText,
            },
        } as unknown as React.ChangeEvent<HTMLDivElement>
        onChange?.(event)
    }

    return (
        <div className={`${styles.syntheticText} ${className}`}
        >
            {blocks.map((block) => (
                <Block key={block.id} block={block} onBlockEdit={onBlockEdit} />
            ))}
        </div>
    )
}

export default SyntheticText

function parseBlocks(text: string): BlockContext[] {
    const lines = text.split("\n");
    const blocks: BlockContext[] = [];
    let offset = 0;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const start = offset;
      const end = offset + line.length + 1; // +1 for \n (except last line)
  
      let type: BlockType = "paragraph";
  
      if (line.trim() === "") {
        type = "empty";
      } else if (line.startsWith("# ")) {
        type = "heading";
      } else if (line.startsWith("> ")) {
        type = "block-quote";
      } else if (line.match(/^\s*[-*+]\s/)) {
        type = "list-item";
      }
  
      blocks.push({
        id: uuid(),
        type,
        text: line,
        start,
        end: i === lines.length - 1 ? text.length : end, // last block ends at full length
      });
  
      offset = end;
    }
  
    if (blocks.length === 0) {
      blocks.push({
        id: uuid(),
        type: "empty",
        text: "",
        start: 0,
        end: 0,
      });
    }
  
    return blocks;
}
