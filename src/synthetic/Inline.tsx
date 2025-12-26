import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Synth.module.scss'
import useSynth, { type InlineContext } from './useSynth'
import Caret, { type Caret as CaretType } from './Caret';


const Inline: React.FC<{
    className?: string;
    inline: InlineContext;
    onEdit?: (inline: InlineContext, text: string) => void;
}> = ({
    className = "",
    inline,
    onEdit = (inline: InlineContext, text: string) => {},
}) => {
    const inlineRef = useRef<HTMLSpanElement>(null)
    const [focus, setFocus] = useState(false)
    const [text, setText] = useState(inline.pure)

    useEffect(() => {
        if (focus) {
            setText(inline.pure);
        }
    }, [focus, inline.pure]);

    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    const [caret, setCaret] = useState<CaretType | null>(null)

    useEffect(() => {
        if (!focus || !inlineRef.current || selection === null) return;
    
        const textNode = inlineRef.current.firstChild || inlineRef.current;
        const sel = window.getSelection();
        if (!sel) return;
    
        try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(selection.start, text.length));
            range.setEnd(textNode, Math.min(selection.end, text.length));
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
        }
    }, [text, focus, selection]);

    useEffect(() => {
        if (focus && !caret) {
            const textLength = text.length;
            setCaret({ offset: textLength });
            setSelection({ start: textLength, end: textLength });
        }
    }, [focus, caret, text.length]);

    useEffect(() => {
        if (focus && selection !== null) {
            setCaret({ offset: selection.start });
        }
    }, [focus, selection]);
    
    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
    
        const range = sel.getRangeAt(0);
        const textNode = inlineRef.current?.firstChild || inlineRef.current;
        if (!textNode || !range.commonAncestorContainer.contains(textNode)) return null;
    
        const selection = {
            start: range.startOffset,
            end: range.endOffset,
        };
        setSelection(selection);
        return selection;
    }, []);

    const onFocus = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()

        setFocus(true)
        setText(prev => prev || inline.pure);
    }, [inline.pure])

    const onBlur = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()

        setFocus(false)
        setSelection(null)
        setCaret(null)
        onEdit(inline, text)
    }, [text, inline, onEdit])

    const onKeyDown = useCallback(    
        (e: React.KeyboardEvent<HTMLSpanElement>) => {
          console.log("aaaonKeyDown", e.key)
            if (!focus) return;
          
          if (e.key === 'Escape') {
            inlineRef.current?.blur();
            return;
          }
    
          if (e.key === 'Enter') {
            e.preventDefault();

            const currentSelection = saveSelection() || selection;
            if (!currentSelection) return;

            const insertPos = currentSelection.start;
            const deleteEnd = currentSelection.start !== currentSelection.end ? currentSelection.end : currentSelection.start;

            const newText =
                text.slice(0, insertPos) + '\n' + text.slice(deleteEnd);

            setText(newText);
            // onEdit(inline, newText)

            const newCursorPos = insertPos + 1;
            setSelection({ start: newCursorPos, end: newCursorPos });
            setCaret({ offset: newCursorPos });
            
            return;
          }
    
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              return;
            }
            saveSelection();
            return;
          }
    
          const currentSelection = saveSelection() || selection;
    
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
    
            // const sel = window.getSelection();
            // if (!sel || sel.rangeCount === 0) return;
            // const range = sel.getRangeAt(0);
            // const start = range.startOffset;
            // const end = range.endOffset;
    
            // Use currentSelection if available, otherwise use DOM selection
            // const insertStart = currentSelection?.start ?? start;
            // const insertEnd = currentSelection?.end ?? end;
    
            const insertStart = selection?.start ?? caret?.offset ?? 0;
            const insertEnd = selection?.end ?? insertStart;

            const newText = text.slice(0, insertStart) + e.key + text.slice(insertEnd);
    
            setText(newText);
            // onEdit(inline, newText)
    
            const newCursorPos = insertStart + 1;
            setSelection({ start: newCursorPos, end: newCursorPos });
            setCaret({ offset: newCursorPos });
            return;
          }
    
          // Backspace / Delete
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
    
            const currentSelection = saveSelection() || selection;
            if (!currentSelection) return;
    
            let newText: string;
            let newCursorPos: number;
    
            if (currentSelection.start === currentSelection.end) {
              if (e.key === 'Backspace') {
                if (currentSelection.start === 0) return;
                newText = text.slice(0, currentSelection.start - 1) + text.slice(currentSelection.start);
                newCursorPos = currentSelection.start - 1;
              } else {
                if (currentSelection.start === text.length) return;
                newText = text.slice(0, currentSelection.start) + text.slice(currentSelection.start + 1);
                newCursorPos = currentSelection.start;
              }
            } else {
              newText = text.slice(0, currentSelection.start) + text.slice(currentSelection.end);
              newCursorPos = currentSelection.start;
            }
    
            setText(newText);
            // onEdit(inline, newText)
            setSelection({ start: newCursorPos, end: newCursorPos });
            setCaret({ offset: newCursorPos });
          }
        },
        [text, selection, inline, focus, saveSelection]
    );



    // console.log("text", JSON.stringify(inline, null, 2), text)

    const { rangeFromMouse, rangeToOffset } = useSynth()
      
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation()

        setFocus(true)
        setText(prev => prev || inline.pure);
      
        const range = rangeFromMouse(e.nativeEvent)
        if (!range || !inlineRef.current) return
      
        const offset = rangeToOffset(inlineRef.current, range)
      
        setCaret({ offset })
    }

    return (
        <span ref={inlineRef} className={`${styles.inline} ${className} ${focus && styles.focus}`}
            tabIndex={0}
            data-start={inline.start}
            data-end={inline.end}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onMouseUp={focus ? saveSelection : undefined}
            onKeyUp={focus ? saveSelection : undefined}
            onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
            onMouseDown={onMouseDown}
        >
            {focus ? (
                <Caret caret={caret} text={text} onKeyDown={onKeyDown} />
            ) : (
                getInline(inline)
            )}
        </span>
    )
}

function getInline(inline: InlineContext) {
    switch (inline.type) {
        case "text":
            return inline.pure
        case "strong":
            return <strong>{inline.synthetic}</strong>
        case "em":
            return <em>{inline.synthetic}</em>
        case "code":
            return <code>{inline.synthetic}</code>
        case "link":
            return <a href={inline.synthetic}>{inline.synthetic}</a>
    }

    return `${inline.synthetic}`
}

export default Inline
