export {}

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            'synthetic-markdown': {
                ref?: any
                className?: string
                autoFocus?: boolean
                value?: string
                onChange?: (event: Event) => void
                children?: any
                [key: string]: any
            }
        }
    }
}
