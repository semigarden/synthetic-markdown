import { useEffect, useState } from 'react'
import { loadText, saveText } from './db'
import SyntheticText from './react/SyntheticText'

const App = () => {
  const [value, setValue] = useState('')

  useEffect(() => {
    loadText().then(setValue)
  }, [])

  const onChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement
    const v = target.value
    setValue(v)
    saveText(v)
  }

  return (
    <SyntheticText value={value} onChange={onChange} />
  )
}

export default App
