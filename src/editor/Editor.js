/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { unwrapResult } from '@reduxjs/toolkit'
import { fetchContent, error, changes } from '../redux/content'

import {
  Editor,
  EditorState,
  convertFromRaw,
  RichUtils,
  getDefaultKeyBinding,
} from 'draft-js'
import 'draft-js/dist/Draft.css'
import Relations from '../relations/Relations'

import Selector, { emptyData } from './Selector'
import { createEntityFromSelection } from './entities'
import decorator from './decorator'
import parseSelection from './selection'
import Page from '../layout/Page'
import EditorControl from './EditorControl'

const styles = {
  container: theme => ({
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '8.5fr 1.5fr',
    gridTemplateRows: '8.5fr 1.5fr',
    gridTemplateAreas: `
      "editor selector"
      "editor control"
      `,
    padding: '1rem',
  }),
  editor: {
    gridArea: 'editor',
  },
  selector: {
    gridArea: 'selector',
  },
  control: {
    gridArea: 'control',
  },
  relations: {},
}

const MyEditor = () => {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  )
  const [data, setData] = useState(emptyData)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const { editor } = useSelector(store => store.app.view)
  const dispatch = useDispatch()

  const uSetSelectorOpen = useCallback(setSelectorOpen, [setSelectorOpen])
  const uSetData = useCallback(setData, [setData])

  const handleChange = newEditorState => {
    // only report changes that have the potential to change entities positions
    // contentState immutability enables using referntial equality for comparison
    const oldContent = editorState.getCurrentContent()
    const newContent = newEditorState.getCurrentContent()
    const contentChanged = newContent !== oldContent
    if (contentChanged) dispatch(changes())

    setEditorState(newEditorState)

    const { selectionExists } = parseSelection(newEditorState)
    if (selectionExists) setSelectorOpen(true)
  }

  // ! No editing
  // Editing is probably not required.
  // However if it is ever required, then every key stroke would have to update all entityRanges in redux, or alternatively
  // decoratorComponents (dc) would have to find another way to find the index of the proper entityRange to update.
  // That update is required to keep reactflow's nodes on the same x/y coordinates of draft-js' entities.
  //
  // Failing to update their up-to-date offsets in redux will make cd's 'find' return -1 and content.js to throw,
  // since offsets *will* change in strategies.js.
  const myKeyBindingFn = e => {
    if (e.keyCode < 90) return 'editing'
    return getDefaultKeyBinding(e)
  }
  const handleKeyCommand = (command, editorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command)

    if (newState) {
      this.onChange(newState)
      return 'handled'
    }

    return 'not-handled'
  }

  // conversion
  useEffect(() => {
    const convertContent = rawContent => convertFromRaw(rawContent)

    const showContent = content =>
      setEditorState(EditorState.createWithContent(content, decorator))

    dispatch(fetchContent({ convertContent, showContent }))
      .then(unwrapResult)
      .catch(serializedError => {
        console.error(serializedError)
        dispatch(error('content'))
      })
  }, [dispatch])

  // selection & entity creation
  useEffect(() => {
    const { selectionExists, selectionSpansBlocks } = parseSelection(
      editorState
    )
    if (selectionExists && selectionSpansBlocks) {
      // alert('Please select inside a single block') // ToDo: replace alert with a snackbar
      return
    }
    if (selectionExists && data.entityType) {
      const newEditorState = createEntityFromSelection({
        editorState,
        data,
        dispatch,
      })
      setEditorState(newEditorState)
      setData(emptyData)
    }
  }, [dispatch, editorState, data])

  return (
    <Page>
      <div css={styles.container}>
        <div
          css={styles.editor}
          style={{ visibility: editor ? 'visible' : 'hidden' }}
        >
          <Editor
            editorState={editorState}
            onChange={handleChange}
            keyBindingFn={myKeyBindingFn}
            handleKeyCommand={handleKeyCommand}
            css={styles.editor}
          />
        </div>

        <div css={styles.selector}>
          <Selector
            {...{
              selectorOpen,
              uSetSelectorOpen,
              uSetData,
            }}
          />
        </div>

        <div css={styles.relations}>
          <Relations />
        </div>

        <div css={styles.control}>
          <EditorControl />
        </div>
      </div>
    </Page>
  )
}
export default MyEditor
