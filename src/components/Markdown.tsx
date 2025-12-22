import React, { useState } from 'react'
import styles from '@/styles/components/Markdown.module.scss'
import { parseBlock, renderBlock } from '@/utils/parser'

const Markdown: React.FC = () => {
  const [text, setText] = useState('')

  const document = parseBlock(text)

  return (
    <div className={styles.markdown}>
      <div className={styles.content}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
        />
        <div
          className={styles.preview}
          dangerouslySetInnerHTML={{ __html: renderBlock(document) }}
        />
      </div>
    </div>
  )
}

export default Markdown
