export {}

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            'synthetic-text': {
                ref?: any
                className?: string
                autofocus?: boolean
                value?: string
                onInput?: (event: Event) => void
                children?: any
                [key: string]: any
            }
        }
    }
}
