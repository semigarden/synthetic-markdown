import { forwardRef, useRef } from 'react'
import 'synthetic-markdown'

type Props = {
    ref?: React.RefObject<HTMLTextAreaElement | null>
    className?: string
    autoFocus?: boolean
    value?: string
    onChange: (event: Event) => void
}

const SyntheticMarkdown = forwardRef(({ className, autoFocus = false, value = '', onChange }: Props, ref) => {
    const elementRef = useRef<HTMLElement>(null)

    return (
        <synthetic-markdown
            ref={(node: HTMLElement | null) => {
                elementRef.current = node
                if (typeof ref === 'function') {
                    ref(node)
                } else if (ref) {
                    (ref as React.MutableRefObject<HTMLElement | null>).current = node
                }
            }} 
            className={className} 
            value={value} 
            onChange={onChange}
            autofocus={autoFocus}
        />
    )
})

export default SyntheticMarkdown
