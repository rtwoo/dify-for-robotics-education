import { renderHook } from '@testing-library/react'
import { BlockEnum } from '@/app/components/workflow/types'
import { useAvailableNodesMetaData } from '../use-available-nodes-meta-data'

const mockUseIsChatMode = vi.fn()
const mockWorkflowState = vi.hoisted(() => ({
  pololuMicropython: undefined as Record<string, unknown> | undefined,
}))

vi.mock('@/app/components/workflow-app/hooks/use-is-chat-mode', () => ({
  useIsChatMode: () => mockUseIsChatMode(),
}))

vi.mock('@/app/components/workflow/store', () => ({
  useStore: (selector: (state: typeof mockWorkflowState) => unknown) => selector(mockWorkflowState),
}))

vi.mock('@/context/i18n', () => ({
  useDocLink: () => (path: string) => `/docs${path}`,
}))

describe('useAvailableNodesMetaData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowState.pololuMicropython = undefined
  })

  it('should include chat-specific nodes and make the start node undeletable in chat mode', () => {
    mockUseIsChatMode.mockReturnValue(true)

    const { result } = renderHook(() => useAvailableNodesMetaData())

    expect(result.current.nodesMap?.[BlockEnum.Start]?.metaData.isUndeletable).toBe(true)
    expect(result.current.nodesMap?.[BlockEnum.Answer]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.End]).toBeUndefined()
    expect(result.current.nodesMap?.[BlockEnum.TriggerWebhook]).toBeUndefined()
    expect(result.current.nodesMap?.[BlockEnum.VariableAssigner]).toBe(result.current.nodesMap?.[BlockEnum.VariableAggregator])
    expect(result.current.nodesMap?.[BlockEnum.Start]?.metaData.helpLinkUri).toContain('/docs/use-dify/nodes/')
  })

  it('should include workflow-specific trigger and end nodes outside chat mode', () => {
    mockUseIsChatMode.mockReturnValue(false)

    const { result } = renderHook(() => useAvailableNodesMetaData())

    expect(result.current.nodesMap?.[BlockEnum.Start]?.metaData.isUndeletable).toBe(false)
    expect(result.current.nodesMap?.[BlockEnum.End]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.TriggerWebhook]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.TriggerSchedule]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.TriggerPlugin]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.Answer]).toBeUndefined()
    expect(result.current.nodesMap?.[BlockEnum.Start]?.defaultValue).toMatchObject({
      type: BlockEnum.Start,
      title: 'workflow.blocks.start',
    })
  })

  it('should restrict the palette for Pololu MicroPython workflows', () => {
    mockUseIsChatMode.mockReturnValue(false)
    mockWorkflowState.pololuMicropython = { enabled: true }

    const { result } = renderHook(() => useAvailableNodesMetaData())

    expect(result.current.nodesMap?.[BlockEnum.PololuAction]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.Start]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.End]).toBeDefined()
    expect(result.current.nodesMap?.[BlockEnum.LLM]).toBeUndefined()
    expect(result.current.nodesMap?.[BlockEnum.TriggerWebhook]).toBeUndefined()
    expect(result.current.nodesMap).not.toHaveProperty(BlockEnum.VariableAssigner)
  })
})
