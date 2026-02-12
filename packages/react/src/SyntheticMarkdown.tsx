import { forwardRef, useRef, useEffect } from 'react'
import 'synthetic-markdown'

type Props = {
    ref?: React.RefObject<HTMLTextAreaElement | null>
    className?: string
    autoFocus?: boolean
    editable?: boolean
    value?: string
    onChange: (event: Event) => void
}

const SyntheticMarkdown = forwardRef(({ className, autoFocus = false, editable = true, value = '', onChange }: Props, ref) => {
    const elementRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const element = elementRef.current as any
        if (!element) return
        if (element.value !== value) element.value = value
    }, [value])
  
    useEffect(() => {
        const element = elementRef.current as any
        if (!element) return
        element.autofocus = autoFocus
        element.editable = editable
    }, [autoFocus, editable])

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
            onChange={onChange}
        />
    )
})

export default SyntheticMarkdown
