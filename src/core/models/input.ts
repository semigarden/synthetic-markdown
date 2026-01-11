import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Selection from './selection'

class Input {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public selection: Selection,
        public render: Render
    ) {}
}

export default Input
