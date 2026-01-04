type Intent =
    | 'enter'
    | 'backspace'

const onKey: Record<string, Intent> = {
    'Enter': 'enter',
    'Backspace': 'backspace',
}

export { onKey, Intent }
