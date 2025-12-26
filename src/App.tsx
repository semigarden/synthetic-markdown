import SyntheticText from './components/SyntheticText'
import { useState, useCallback, useEffect } from 'react'
import useStore from './hooks/useStore'

function App() {
  const { loadText, saveText } = useStore();
  const [text, setText] = useState("");

  useEffect(() => {
    loadText().then(setText);
  }, []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLDivElement>) => {
    const value = (e.target as any).value;
    setText(value);
    saveText(value).catch(console.error);
  }, []);

  return (
    <SyntheticText
      value={text}
      onChange={onChange}
    />
  );
}


export default App
