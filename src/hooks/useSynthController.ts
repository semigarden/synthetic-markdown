import { useLayoutEffect, useRef, useState } from "react";

import { createSynthEngine, type SynthEngine } from "./createSynthEngine";

export function useSynthController(value: string) {
    const engineRef = useRef<SynthEngine>(null);
    if (!engineRef.current) {
        engineRef.current = createSynthEngine();
    }

    const engine = engineRef.current;
    const [, forceRender] = useState(0);

    const caretRef = useRef<{
        inlineId: string;
        offset: number;
    } | null>(null);

    useLayoutEffect(() => {
        engine.receiveText(value);
        forceRender(x => x + 1);
    }, [value]);

    function saveCaret(inlineId: string, offset: number) {
        caretRef.current = { inlineId, offset };
    }

    function restoreCaret() {
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
    }

    return {
        blocks: engine.getBlocks(),
        getInlines: engine.getInlines,
        applyInlineEdit: engine.applyInlineEdit,
        saveCaret,
        restoreCaret,
    };
}
  