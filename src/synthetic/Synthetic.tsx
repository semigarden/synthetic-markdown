import React, { useRef, useLayoutEffect, useCallback } from "react"
import styles from "../styles/SyntheticText.module.scss"

type TextBuffer = {
    text: string
    selection: {
        start: number,
        end: number,
    }
}

const Synthetic: React.FC<{
    className?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void
    props?: React.HTMLAttributes<HTMLDivElement>
}> = ({
    className = "",
    value = "",
    onChange = () => {},
    props,
}) => {
    const syntheticRef = useRef<HTMLDivElement>(null) 

    const textBufferRef = useRef<TextBuffer>({
        text: value,
        selection: { start: 0, end: 0 },
    })

    useLayoutEffect(() => {
        if (value !== textBufferRef.current.text) {
            textBufferRef.current.text = value
        }
    }, [value])

    useLayoutEffect(() => {
        const el = syntheticRef.current
        if (!el) return
    
        // Project text
        if (el.innerText !== textBufferRef.current.text) {
          el.innerText = textBufferRef.current.text
        }
    
        // Restore selection
        const { start, end } = textBufferRef.current.selection
        restoreSelection(el, start, end)
      })
    
    const onInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        const el = syntheticRef.current
        if (!el) return
    
        const newText = el.innerText
        const selection = readSelection(el)
    
        textBufferRef.current = {
          text: newText,
          selection,
        }
    
        onChange?.({
            ...e,
            target: { ...e.currentTarget, value: newText },
            currentTarget: { ...e.currentTarget, value: newText },
        } as React.ChangeEvent<HTMLDivElement>)
    }, [onChange, textBufferRef])

    return (
        <div
            ref={syntheticRef}
            className={`${styles.syntheticText} ${className}`}
            contentEditable
            suppressContentEditableWarning
            onInput={onInput}
            style={{
                whiteSpace: "pre-wrap",
                outline: "none",
                fontFamily: "monospace",
            }}
            {...props}
        />
    )
}

export { Synthetic }

function readSelection(root: HTMLElement): { start: number; end: number } {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      return { start: 0, end: 0 }
    }
  
    const range = sel.getRangeAt(0)
  
    const preStart = range.cloneRange()
    preStart.selectNodeContents(root)
    preStart.setEnd(range.startContainer, range.startOffset)
  
    const start = preStart.toString().length
    const end = start + range.toString().length
  
    return { start, end }
  }
  
function restoreSelection(
    root: HTMLElement,
    start: number,
    end: number
) {
    const range = document.createRange()
    const sel = window.getSelection()
    if (!sel) return
  
    let charIndex = 0
    let startNode: Node | null = null
    let startOffset = 0
    let endNode: Node | null = null
    let endOffset = 0
  
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nextCharIndex = charIndex + node.length
  
      if (!startNode && start <= nextCharIndex) {
        startNode = node
        startOffset = start - charIndex
      }
  
      if (!endNode && end <= nextCharIndex) {
        endNode = node
        endOffset = end - charIndex
        break
      }
  
      charIndex = nextCharIndex
    }
  
    if (!startNode || !endNode) return
  
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
  
    sel.removeAllRanges()
    sel.addRange(range)
}
  