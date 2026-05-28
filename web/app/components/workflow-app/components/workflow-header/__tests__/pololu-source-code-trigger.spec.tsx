import { fireEvent, screen } from '@testing-library/react'
import { renderWorkflowComponent } from '@/app/components/workflow/__tests__/workflow-test-env'
import PololuSourceCodeTrigger from '../pololu-source-code-trigger'

const mockCloseAllInputFieldPanels = vi.fn()

vi.mock('@/app/components/rag-pipeline/hooks', () => ({
  useInputFieldPanel: () => ({
    closeAllInputFieldPanels: mockCloseAllInputFieldPanels,
  }),
}))

vi.mock('@/hooks/use-theme', () => ({
  default: () => ({
    theme: 'light',
  }),
}))

describe('PololuSourceCodeTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render only for Pololu MicroPython workflows', () => {
    renderWorkflowComponent(<PololuSourceCodeTrigger />)

    expect(screen.queryByRole('button', { name: /pololu\.actions\.showPanel/i })).not.toBeInTheDocument()
  })

  it('should toggle the source code panel and close other side panels when opened', () => {
    const storeRef: { current?: ReturnType<typeof renderWorkflowComponent>['store'] } = {}
    const { store } = renderWorkflowComponent(
      <PololuSourceCodeTrigger />,
      {
        initialStoreState: {
          pololuMicropython: { enabled: true },
          showChatVariablePanel: true,
          showEnvPanel: true,
          showGlobalVariablePanel: true,
          showDebugAndPreviewPanel: true,
          showPololuMicropythonPanel: false,
          setShowPololuMicropythonPanel: (show: boolean) => {
            storeRef.current?.setState({ showPololuMicropythonPanel: show })
          },
        },
      },
    )
    storeRef.current = store

    fireEvent.click(screen.getByRole('button', { name: /pololu\.actions\.showPanel/i }))

    expect(store.getState().showPololuMicropythonPanel).toBe(true)
    expect(store.getState().showChatVariablePanel).toBe(false)
    expect(store.getState().showEnvPanel).toBe(false)
    expect(store.getState().showGlobalVariablePanel).toBe(false)
    expect(store.getState().showDebugAndPreviewPanel).toBe(false)
    expect(mockCloseAllInputFieldPanels).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /pololu\.actions\.hidePanel/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
