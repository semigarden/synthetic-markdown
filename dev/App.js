import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { loadText, saveText } from './db';
import SyntheticText from '../react/SyntheticText';
const App = () => {
    const [value, setValue] = useState('');
    useEffect(() => {
        loadText().then(setValue);
    }, []);
    const handleChange = (v) => {
        setValue(v);
        saveText(v);
    };
    return (_jsx(SyntheticText, { value: value, onChange: handleChange }));
};
export default App;
