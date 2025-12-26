import React, { useRef, useState } from 'react'
import styles from '../styles/Synth.module.scss'
import Block from './Block'
import useSynth, { type BlockContext } from './useSynth'


const SyntheticText: React.FC<{
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void;
}> = ({
    className = "",
    value,
    onChange = () => {},
}) => {
    const { parseBlocks } = useSynth()
    const syntheticRef = useRef<HTMLDivElement>(null)
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
        <div ref={syntheticRef} className={`${styles.syntheticText} ${className}`}
        >
            {blocks.map((block) => (
                <Block key={block.id} block={block} onBlockEdit={onBlockEdit} />
            ))}
        </div>
    )
}

export default SyntheticText

