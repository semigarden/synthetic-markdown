import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Selection from './selection'

class Intent {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public selection: Selection,
        public render: Render
    ) {}

    public handle(event: KeyboardEvent) {
        console.log('handle', event)
    }
}

export default Intent
