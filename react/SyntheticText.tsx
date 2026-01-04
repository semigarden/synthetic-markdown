import { useEffect } from 'react'
import { defineSyntheticText } from '../core'

type Props = {
    value: string
    onChange: (text: string) => void
}

const SyntheticText = ({ value, onChange }: Props) => {
    useEffect(() => {
        defineSyntheticText()
      }, [])

    return (
        <synthetic-text value={value} onChange={(e) => {
            onChange(e.nativeEvent.detail.value)
        }} />
    )
}

export default SyntheticText
