'use client'

import type { Editor } from '@monaco-editor/react'
import type { ComponentProps } from 'react'
import type { Edge, Node } from '@/app/components/workflow/types'
import type { PololuDiagnostic, PololuGraphResponse, PololuWorkflowGraph } from '@/service/pololu-micropython'
import { Button } from '@langgenius/dify-ui/button'
import { toast } from '@langgenius/dify-ui/toast'
import { RiDownloadLine, RiRefreshLine, RiUploadLine } from '@remixicon/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEdges, useNodes, useStoreApi } from 'reactflow'
import { useNodesSyncDraft } from '@/app/components/workflow/hooks/use-nodes-sync-draft'
import CodeEditor from '@/app/components/workflow/nodes/_base/components/editor/code-editor'
import { CodeLanguage } from '@/app/components/workflow/nodes/code/types'
import { useStore, useWorkflowStore } from '@/app/components/workflow/store'
import { initialEdges, initialNodes } from '@/app/components/workflow/utils'
import {
  compilePololuMicropython,
  exportPololuMicropython,
  pololuCodeToGraph,
  pololuGraphToCode,
} from '@/service/pololu-micropython'
import { downloadBlob } from '@/utils/download'

type EditorOnMount = NonNullable<ComponentProps<typeof Editor>['onMount']>
type MonacoEditor = Parameters<EditorOnMount>[0]
type Monaco = Parameters<EditorOnMount>[1]

function hasError(diagnostics: PololuDiagnostic[]) {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error')
}

function PololuMicropythonPanel() {
  const { t } = useTranslation()
  const appId = useStore(s => s.appId)
  const appName = useStore(s => s.appName)
  const workflowStore = useWorkflowStore()
  const reactFlowStore = useStoreApi()
  const nodes = useNodes() as Node[]
  const edges = useEdges() as Edge[]
  const { handleSyncWorkflowDraft } = useNodesSyncDraft()
  const [code, setCode] = useState('')
  const [diagnostics, setDiagnostics] = useState<PololuDiagnostic[]>([])
  const [parsedGraph, setParsedGraph] = useState<PololuGraphResponse['graph']>()
  const [hasCodeEdits, setHasCodeEdits] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const editorRef = useRef<MonacoEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const graph = useMemo<PololuWorkflowGraph>(() => {
    const [x, y, zoom] = reactFlowStore.getState().transform
    return {
      nodes,
      edges,
      viewport: { x, y, zoom },
    }
  }, [edges, nodes, reactFlowStore])

  const refreshCode = useCallback(async () => {
    if (!appId)
      return
    setIsWorking(true)
    try {
      const response = await pololuGraphToCode({ appId, graph })
      setCode(response.code)
      setDiagnostics(response.diagnostics)
      setParsedGraph(undefined)
      workflowStore.setState(state => ({
        pololuMicropython: {
          ...state.pololuMicropython,
          enabled: true,
          last_graph_hash: response.graph_hash,
          last_ir_hash: response.ir_hash,
        },
      }))
      setHasCodeEdits(false)
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('pololu.messages.generateFailed', { ns: 'workflow' }))
    }
    finally {
      setIsWorking(false)
    }
  }, [appId, graph, t, workflowStore])

  useEffect(() => {
    if (!hasCodeEdits)
      refreshCode()
  }, [graph, hasCodeEdits, refreshCode])

  useEffect(() => {
    if (!hasCodeEdits || !appId)
      return

    const timer = window.setTimeout(async () => {
      try {
        const response = await pololuCodeToGraph({ appId, code })
        setDiagnostics(response.diagnostics)
        setParsedGraph(hasError(response.diagnostics) ? undefined : response.graph)
      }
      catch (error) {
        setParsedGraph(undefined)
        setDiagnostics([{
          severity: 'error',
          message: error instanceof Error ? error.message : t('pololu.messages.parseFailed', { ns: 'workflow' }),
        }])
      }
    }, 500)

    return () => window.clearTimeout(timer)
  }, [appId, code, hasCodeEdits, t])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor?.getModel?.()
    if (!editor || !monaco || !model)
      return

    monaco.editor.setModelMarkers(model, 'pololu-micropython', diagnostics.map((diagnostic) => {
      const line = diagnostic.line || 1
      const column = diagnostic.column || 1
      return {
        message: diagnostic.message,
        severity: diagnostic.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: column + 1,
      }
    }))
  }, [diagnostics])

  const applyCodeToWorkflow = useCallback(() => {
    if (!parsedGraph)
      return
    const { setNodes, setEdges } = reactFlowStore.getState()
    const nextNodes = initialNodes(parsedGraph.nodes, parsedGraph.edges)
    const nextEdges = initialEdges(parsedGraph.edges, parsedGraph.nodes)
    setNodes(nextNodes)
    setEdges(nextEdges)
    setHasCodeEdits(false)
    window.setTimeout(() => handleSyncWorkflowDraft(true), 0)
  }, [handleSyncWorkflowDraft, parsedGraph, reactFlowStore])

  const compile = useCallback(async () => {
    if (!appId)
      return
    setIsWorking(true)
    try {
      const response = await compilePololuMicropython({ appId, graph })
      setDiagnostics(response.diagnostics)
      if (hasError(response.diagnostics))
        toast.error(t('pololu.messages.compileFailed', { ns: 'workflow' }))
      else
        toast.success(t('pololu.messages.compiled', { ns: 'workflow' }))
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('pololu.messages.compileFailed', { ns: 'workflow' }))
    }
    finally {
      setIsWorking(false)
    }
  }, [appId, graph, t])

  const exportZip = useCallback(async () => {
    if (!appId)
      return
    setIsWorking(true)
    try {
      const blob = await exportPololuMicropython({ appId, graph })
      downloadBlob({ data: blob, fileName: `${appName || 'pololu-micropython'}.zip` })
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('pololu.messages.exportFailed', { ns: 'workflow' }))
    }
    finally {
      setIsWorking(false)
    }
  }, [appId, appName, graph, t])

  return (
    <aside className="absolute top-24 right-3 bottom-3 z-20 flex w-[460px] flex-col border border-components-panel-border bg-components-panel-bg shadow-xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-divider-subtle px-3">
        <div className="system-sm-semibold-uppercase text-text-secondary">{t('pololu.panelTitle', { ns: 'workflow' })}</div>
        <div className="flex items-center gap-1">
          <Button size="small" disabled={isWorking} onClick={refreshCode}>
            <RiRefreshLine className="mr-1 size-3.5" />
            {t('pololu.actions.regenerate', { ns: 'workflow' })}
          </Button>
          <Button size="small" disabled={isWorking || hasError(diagnostics)} onClick={compile}>
            {t('pololu.actions.compile', { ns: 'workflow' })}
          </Button>
          <Button size="small" disabled={isWorking || hasError(diagnostics)} onClick={exportZip}>
            <RiDownloadLine className="mr-1 size-3.5" />
            {t('pololu.actions.export', { ns: 'workflow' })}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          noWrapper
          isExpand
          language={CodeLanguage.python3}
          value={code}
          onChange={(value) => {
            setCode(value)
            setHasCodeEdits(true)
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor
            monacoRef.current = monaco
          }}
        />
      </div>
      <div className="shrink-0 border-t border-divider-subtle p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="system-xs-semibold-uppercase text-text-tertiary">{t('pololu.diagnostics', { ns: 'workflow' })}</div>
          <Button size="small" variant="primary" disabled={!parsedGraph || hasError(diagnostics)} onClick={applyCodeToWorkflow}>
            <RiUploadLine className="mr-1 size-3.5" />
            {t('pololu.actions.applyToWorkflow', { ns: 'workflow' })}
          </Button>
        </div>
        <div className="max-h-28 overflow-y-auto">
          {diagnostics.length === 0 && (
            <div className="system-xs-regular text-text-tertiary">{t('pololu.messages.noDiagnostics', { ns: 'workflow' })}</div>
          )}
          {diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.line}-${diagnostic.message}-${index}`} className="mb-1 system-xs-regular text-text-tertiary">
              <span className={diagnostic.severity === 'error' ? 'text-text-destructive' : 'text-text-warning-secondary'}>
                {diagnostic.severity}
              </span>
              {diagnostic.line ? ` ${diagnostic.line}: ` : ': '}
              {diagnostic.message}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default PololuMicropythonPanel
