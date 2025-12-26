import { uuid } from "../utils";

export type BlockType =
  | "paragraph"
  | "heading"
  | "block-quote"
  | "list-item"
  | "empty";

export type InlineType =
  | "text"
  | "strong"
  | "em"
  | "code";

export interface InlineContext {
  id: string;
  type: InlineType;
  blockId: string;
  synthetic: string;
  pure: string;
  start: number;
  end: number;
}

export interface BlockContext {
  id: string;
  type: BlockType;
  text: string;
  start: number;
  end: number;
}

export function createSynthEngine() {
    let sourceText = "";
    let blocks: BlockContext[] = [];
    let inlines = new Map<string, InlineContext[]>();

    function detectType(line: string): BlockType {
        if (line.trim() === "") return "empty";
        if (line.startsWith("# ")) return "heading";
        if (line.startsWith("> ")) return "block-quote";
        if (/^\s*[-*+]\s/.test(line)) return "list-item";
        return "paragraph";
    }

    function parseBlocks(text: string): BlockContext[] {
        const prev = blocks;
        const lines = text.split("\n");
    
        let offset = 0;
        const next: BlockContext[] = [];
    
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const start = offset;
          const end =
            i === lines.length - 1 ? text.length : offset + line.length + 1;
    
          const type = detectType(line);
          const prevBlock = prev.find(b => b.start === start && b.type === type);
    
          next.push({
            id: prevBlock?.id ?? uuid(),
            type,
            text: line,
            start,
            end,
          });
    
          offset = end;
        }
    
        blocks = next;
        sourceText = text;
        return next;
    }

    function parseInlines(block: BlockContext): InlineContext[] {
        const prev = inlines.get(block.id) ?? [];
        const next: InlineContext[] = [];
    
        let i = 0;
        let reuseIndex = 0;
        const text = block.text;
    
        const reuse = (
          type: InlineType,
          start: number,
          end: number,
          synthetic: string,
          pure: string
        ) => {
          const cand = prev[reuseIndex];
          reuseIndex++;
    
          if (cand && cand.type === type && cand.start === start && cand.end === end) {
            return { ...cand, synthetic, pure };
          }
    
          return {
            id: uuid(),
            type,
            blockId: block.id,
            synthetic,
            pure,
            start,
            end,
          };
        };
    
        while (i < text.length) {
          if (text[i] === "`") {
            const end = text.indexOf("`", i + 1);
            if (end !== -1) {
              next.push(reuse("code", i, end + 1, text.slice(i + 1, end), text.slice(i, end + 1)));
              i = end + 1;
              continue;
            }
          }
    
          if (text.slice(i, i + 2) === "**") {
            const end = text.indexOf("**", i + 2);
            if (end !== -1) {
              next.push(reuse("strong", i, end + 2, text.slice(i + 2, end), text.slice(i, end + 2)));
              i = end + 2;
              continue;
            }
          }
    
          if (text[i] === "*") {
            const end = text.indexOf("*", i + 1);
            if (end !== -1) {
              next.push(reuse("em", i, end + 1, text.slice(i + 1, end), text.slice(i, end + 1)));
              i = end + 1;
              continue;
            }
          }
    
          let nextDelim = text.length;
          for (const d of ["**", "*", "`"]) {
            const p = text.indexOf(d, i + 1);
            if (p !== -1 && p < nextDelim) nextDelim = p;
          }
    
          next.push(reuse("text", i, nextDelim, text.slice(i, nextDelim), text.slice(i, nextDelim)));
          i = nextDelim;
        }
    
        inlines.set(block.id, next);
        return next;
    }

    function receiveText(text: string) {
        parseBlocks(text);
      }
    
      function getBlocks() {
        return blocks;
      }
    
      function getInlines(block: BlockContext) {
        return parseInlines(block);
      }
    
      function applyInlineEdit(inline: InlineContext, nextInlineText: string): string {
        const block = blocks.find(b => b.id === inline.blockId)!;
    
        const newBlockText =
          block.text.slice(0, inline.start) +
          nextInlineText +
          block.text.slice(inline.end);
    
        const newText =
          sourceText.slice(0, block.start) +
          newBlockText +
          sourceText.slice(block.end);
    
        receiveText(newText);
        return newText;
    }

    return {
        receiveText,
        getBlocks,
        getInlines,
        applyInlineEdit,
    };
}

export type SynthEngine = ReturnType<typeof createSynthEngine>;
