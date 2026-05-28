import type { PololuActionNodeType } from './types'
import type { NodeProps } from '@/app/components/workflow/types'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

function PololuActionNode({ data }: NodeProps<PololuActionNodeType>) {
  const { t } = useTranslation()
  const operation = data.operation
  const parameters = data.parameters || {}

  const summary = (() => {
    if (operation === 'set_motors')
      return `${parameters.left ?? 0}, ${parameters.right ?? 0}`
    if (operation === 'wait')
      return `${parameters.seconds ?? 0}s`
    if (operation === 'display_text')
      return String(parameters.text ?? '')
    if (operation === 'yellow_led')
      return parameters.on ? t('pololu.node.on', { ns: 'workflow' }) : t('pololu.node.off', { ns: 'workflow' })
    if (operation === 'rgb_led')
      return `LED ${parameters.led ?? 0}`
    return ''
  })()

  if (!summary)
    return null

  return (
    <div className="px-3 pb-2 system-xs-regular text-text-tertiary">
      {summary}
    </div>
  )
}

export default memo(PololuActionNode)
