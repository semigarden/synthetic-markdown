import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { defineSyntheticText } from '../core';
const SyntheticText = ({ value, onChange }) => {
    useEffect(() => {
        defineSyntheticText();
    }, []);
    return (_jsx("synthetic-text", { value: value, onChange: (e) => {
            onChange(e.nativeEvent.detail.value);
        } }));
};
export default SyntheticText;
