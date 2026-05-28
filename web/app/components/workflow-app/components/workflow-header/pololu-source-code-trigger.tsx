import { Button } from '@langgenius/dify-ui/button'
import { cn } from '@langgenius/dify-ui/cn'
import { RiCodeLine } from '@remixicon/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInputFieldPanel } from '@/app/components/rag-pipeline/hooks'
import { useStore } from '@/app/components/workflow/store'
import useTheme from '@/hooks/use-theme'

function PololuSourceCodeTrigger() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isPololuProject = useStore(s => !!s.pololuMicropython?.enabled)
  const showPololuMicropythonPanel = useStore(s => !!s.showPololuMicropythonPanel)
  const setShowPololuMicropythonPanel = useStore(s => s.setShowPololuMicropythonPanel)
  const setShowChatVariablePanel = useStore(s => s.setShowChatVariablePanel)
  const setShowEnvPanel = useStore(s => s.setShowEnvPanel)
  const setShowGlobalVariablePanel = useStore(s => s.setShowGlobalVariablePanel)
  const setShowDebugAndPreviewPanel = useStore(s => s.setShowDebugAndPreviewPanel)
  const { closeAllInputFieldPanels } = useInputFieldPanel()

  if (!isPololuProject)
    return null

  const label = showPololuMicropythonPanel
    ? t('pololu.actions.hidePanel', { ns: 'workflow' })
    : t('pololu.actions.showPanel', { ns: 'workflow' })

  const handleClick = () => {
    const nextShowPanel = !showPololuMicropythonPanel
    setShowPololuMicropythonPanel?.(nextShowPanel)
    if (!nextShowPanel)
      return

    setShowChatVariablePanel(false)
    setShowEnvPanel(false)
    setShowGlobalVariablePanel(false)
    setShowDebugAndPreviewPanel(false)
    closeAllInputFieldPanels()
  }

  return (
    <Button
      aria-label={label}
      aria-pressed={showPololuMicropythonPanel}
      className={cn(
        'rounded-lg border border-transparent p-2',
        theme === 'dark' && showPololuMicropythonPanel && 'border-black/5 bg-white/10 backdrop-blur-xs',
      )}
      onClick={handleClick}
      variant="ghost"
    >
      <RiCodeLine className="size-4 text-components-button-secondary-text" />
    </Button>
  )
}

export default memo(PololuSourceCodeTrigger)
