import React, { useLayoutEffect, useImperativeHandle, forwardRef, useCallback, useMemo, useReducer } from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import { createSynthEngine, type SynthEngine } from '../hooks/createSynthEngine'

export interface SyntheticTextRef {
    setValue: (text: string) => void;
    getValue: () => string;
    focus: () => void;
}

export interface SyntheticTextProps {
    className?: string;
    initialValue?: string;
    onChange?: (text: string) => void;
}

const SyntheticText = forwardRef<SyntheticTextRef, SyntheticTextProps>(({
    className = "",
    initialValue = "",
    onChange,
}, ref) => {
    const [, forceRender] = useReducer(x => x + 1, 0);

    const engine = useMemo<SynthEngine>(() => {
        const e = createSynthEngine();
        e.sync(initialValue);
        return e;
    }, []);

    const caretRef = React.useRef<{
        inlineId: string;
        offset: number;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        setValue(text: string) {
            engine.sync(text);
            forceRender();
        },
        getValue() {
            return engine.sourceText;
        },
        focus() {
            const firstInline = engine.blocks[0];
            if (firstInline) {
                const inlines = engine.getInlines(firstInline);
                if (inlines[0]) {
                    document.getElementById(inlines[0].id)?.focus();
                }
            }
        },
    }), [engine]);

    const saveCaret = useCallback((inlineId: string, offset: number) => {
        caretRef.current = { inlineId, offset };
    }, []);

    const restoreCaret = useCallback(() => {
        const caret = caretRef.current;
        if (!caret) return;

        const el = document.getElementById(caret.inlineId);
        if (!el) return;

        const node = el.firstChild ?? el;
        const range = document.createRange();
        range.setStart(node, Math.min(caret.offset, node.textContent?.length ?? 0));
        range.collapse(true);

        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        caretRef.current = null;
    }, []);

    useLayoutEffect(() => {
        restoreCaret();
    });

    const handleInlineInput = useCallback((inline: ReturnType<typeof engine.getInlines>[number], text: string, caretOffset: number) => {
        saveCaret(inline.id, caretOffset);

        const nextMarkdown = engine.applyInlineEdit(inline, text);

        forceRender();

        onChange?.(nextMarkdown);
    }, [engine, onChange, saveCaret]);

    return (
        <div className={`${styles.syntheticText} ${className}`}>
            {engine.blocks.map(block =>
                engine.getInlines(block).map(inline => (
                    <Inline
                        key={inline.id}
                        inline={inline}
                        onInput={({ text, caretOffset }) => {
                            handleInlineInput(inline, text, caretOffset);
                        }}
                    />
                ))
            )}
        </div>
    )
});

SyntheticText.displayName = 'SyntheticText';

export { SyntheticText };
export default SyntheticText
