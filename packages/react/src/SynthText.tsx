import { useEffect, forwardRef, useRef } from 'react'
import { defineElement } from 'synthtext'

type Props = {
    ref?: React.RefObject<HTMLTextAreaElement | null>
    className?: string
    autofocus?: boolean
    value?: string
    onInput: (event: Event) => void
}

const SynthText = forwardRef(({ className, autofocus = false, value = '', onInput }: Props, ref) => {
    const elementRef = useRef<HTMLElement>(null)

    useEffect(() => {
        defineElement()
    }, [])

    return (
        <synthtext
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
            onInput={onInput}
            autofocus={autofocus}
        />
    )
})

export default SynthText
