import { useRef, useEffect, useState } from 'react'
import { SyntheticMarkdown } from 'synthetic-markdown-react'
import styles from '../styles/Sandbox.module.scss'
import { saveText, loadText } from '../utils'

const Sandbox = ({ className = '', active = false }: { className?: string, active?: boolean }) => {
    const syntheticRef = useRef<HTMLTextAreaElement | null>(null)
    const [autofocus, setAutofocus] = useState(active)
    const [text, setText] = useState('')
    
    useEffect(() => {
        loadText().then(text => {
            setText(text)
        })
    }, [])

    useEffect(() => {
        setAutofocus(active)
    }, [active])

    const onInput = (event: Event) => {
        const text = (event.target as HTMLTextAreaElement).value
        setText(text)
        saveText(text)
    }

    return (
        <div className={`${styles.sandbox} ${active && styles.active} ${className}`}>
            <SyntheticMarkdown ref={syntheticRef} className={styles.synthetic} value={text} onInput={onInput} autofocus={autofocus} />
        </div>
    )
}

export default Sandbox
