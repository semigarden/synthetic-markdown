import { renderBlock } from './renderBlock';
import { renderInlines } from './renderInline';
export function renderAST(ast, container, focusedInlineId = null) {
    container.textContent = '';
    for (const block of ast.blocks) {
        container.appendChild(renderBlock(block, container, focusedInlineId));
    }
}
export function patchDOM(changes, container, focusedInlineId = null) {
    const deletes = [];
    const updates = [];
    const moves = [];
    const adds = [];
    for (const change of changes) {
        switch (change.action) {
            case 'delete':
                deletes.push(change);
                break;
            case 'update':
                updates.push(change);
                break;
            case 'move':
                moves.push(change);
                break;
            case 'add':
                adds.push(change);
                break;
        }
    }
    for (const { prevBlock } of deletes) {
        if (!prevBlock)
            continue;
        const el = container.querySelector(`[data-block-id="${prevBlock.id}"]`);
        el?.remove();
    }
    for (const { nextBlock } of updates) {
        if (!nextBlock)
            continue;
        const el = container.querySelector(`[data-block-id="${nextBlock.id}"]`);
        if (!el)
            continue;
        el.textContent = '';
        renderInlines(nextBlock.inlines, el, focusedInlineId);
    }
    const currentChildren = Array.from(container.children);
    for (const change of [...moves, ...adds]) {
        const block = change.nextBlock;
        if (!block)
            continue;
        let el = container.querySelector(`[data-block-id="${block.id}"]`);
        if (!el) {
            el = renderBlock(block, container, focusedInlineId);
            container.appendChild(el);
        }
        const targetIndex = change.index ?? currentChildren.length;
        const referenceNode = currentChildren[targetIndex] || null;
        if (el.nextSibling !== referenceNode) {
            container.insertBefore(el, referenceNode);
        }
    }
}
