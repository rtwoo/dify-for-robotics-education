import type { Viewport } from 'reactflow'
import type { Edge, Node } from '@/app/components/workflow/types'
import type { AppDetailResponse } from '@/models/app'
import type { AppIconType } from '@/types/app'
import { post } from './base'

export type PololuWorkflowGraph = {
  nodes: Node[]
  edges: Edge[]
  viewport?: Viewport
}

export type PololuDiagnostic = {
  message: string
  severity: 'error' | 'warning'
  line?: number | null
  column?: number | null
  node_id?: string | null
  statement_id?: string | null
}

export type PololuSourceMapEntry = {
  statement_id: string
  node_id?: string | null
  line_start: number
  line_end: number
}

export type PololuCodeResponse = {
  code: string
  source_map: PololuSourceMapEntry[]
  diagnostics: PololuDiagnostic[]
  graph_hash: string
  ir_hash: string
}

export type PololuGraphResponse = {
  graph: PololuWorkflowGraph
  diagnostics: PololuDiagnostic[]
  ir_hash: string
}

export type PololuCompileResponse = PololuCodeResponse & {
  files: Array<{
    path: string
    content: string
  }>
}

export type PololuAssistantResponse = {
  result: string
  provider?: string | null
  model?: string | null
}

export const createPololuMicropythonApp = ({
  name,
  icon_type,
  icon,
  icon_background,
  description,
}: {
  name: string
  icon_type?: AppIconType
  icon?: string
  icon_background?: string
  description?: string
}): Promise<AppDetailResponse> => {
  return post<AppDetailResponse>('apps/pololu-micropython', {
    body: { name, icon_type, icon, icon_background, description },
  })
}

export const pololuGraphToCode = ({
  appId,
  graph,
}: {
  appId: string
  graph?: PololuWorkflowGraph
}): Promise<PololuCodeResponse> => {
  return post<PololuCodeResponse>(`apps/${appId}/pololu-micropython/graph-to-code`, { body: { graph } }, { silent: true })
}

export const pololuCodeToGraph = ({
  appId,
  code,
}: {
  appId: string
  code: string
}): Promise<PololuGraphResponse> => {
  return post<PololuGraphResponse>(`apps/${appId}/pololu-micropython/code-to-graph`, { body: { code } }, { silent: true })
}

export const compilePololuMicropython = ({
  appId,
  graph,
}: {
  appId: string
  graph?: PololuWorkflowGraph
}): Promise<PololuCompileResponse> => {
  return post<PololuCompileResponse>(`apps/${appId}/pololu-micropython/compile`, { body: { graph } }, { silent: true })
}

export const exportPololuMicropython = ({
  appId,
  graph,
}: {
  appId: string
  graph?: PololuWorkflowGraph
}): Promise<Blob> => {
  return post<Blob>(`apps/${appId}/pololu-micropython/export`, { body: { graph } }, { silent: true })
}

export const pololuMicropythonAssistant = ({
  appId,
  instruction,
  code,
  diagnostics,
  modelConfig,
}: {
  appId: string
  instruction: string
  code?: string
  diagnostics?: PololuDiagnostic[]
  modelConfig?: Record<string, unknown>
}): Promise<PololuAssistantResponse> => {
  return post<PololuAssistantResponse>(`apps/${appId}/pololu-micropython/assistant`, {
    body: {
      instruction,
      code,
      diagnostics,
      model_config: modelConfig,
    },
  }, { silent: true })
}
