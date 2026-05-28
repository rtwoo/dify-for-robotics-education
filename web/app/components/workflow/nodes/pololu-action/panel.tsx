import type { PololuActionNodeType } from './types'
import type { NodePanelProps } from '@/app/components/workflow/types'
import { Input } from '@langgenius/dify-ui/input'
import { produce } from 'immer'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNodesReadOnly } from '@/app/components/workflow/hooks'
import Field from '@/app/components/workflow/nodes/_base/components/field'
import TypeSelector from '@/app/components/workflow/nodes/_base/components/selector'
import useNodeCrud from '@/app/components/workflow/nodes/_base/hooks/use-node-crud'
import { PololuOperation } from './types'

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function PololuActionPanel({ id, data }: NodePanelProps<PololuActionNodeType>) {
  const { t } = useTranslation()
  const { nodesReadOnly } = useNodesReadOnly()
  const { inputs, setInputs } = useNodeCrud<PololuActionNodeType>(id, data)

  const operationOptions = [
    { value: PololuOperation.setMotors, label: t('pololu.operations.set_motors', { ns: 'workflow' }) },
    { value: PololuOperation.stopMotors, label: t('pololu.operations.stop_motors', { ns: 'workflow' }) },
    { value: PololuOperation.wait, label: t('pololu.operations.wait', { ns: 'workflow' }) },
    { value: PololuOperation.displayText, label: t('pololu.operations.display_text', { ns: 'workflow' }) },
    { value: PololuOperation.yellowLed, label: t('pololu.operations.yellow_led', { ns: 'workflow' }) },
    { value: PololuOperation.rgbLed, label: t('pololu.operations.rgb_led', { ns: 'workflow' }) },
    { value: PololuOperation.buzzerBeep, label: t('pololu.operations.buzzer_beep', { ns: 'workflow' }) },
  ]

  const updateOperation = (operation: PololuOperation) => {
    const defaults: Record<PololuOperation, Record<string, number | string | boolean>> = {
      [PololuOperation.setMotors]: { left: 1000, right: 1000 },
      [PololuOperation.stopMotors]: {},
      [PololuOperation.wait]: { seconds: 1 },
      [PololuOperation.displayText]: { text: 'Hello', x: 0, y: 0 },
      [PololuOperation.yellowLed]: { on: true },
      [PololuOperation.rgbLed]: { led: 0, red: 0, green: 32, blue: 0 },
      [PololuOperation.buzzerBeep]: {},
    }
    setInputs({
      ...inputs,
      operation,
      parameters: defaults[operation],
    })
  }

  const updateParameter = (key: string, value: number | string | boolean) => {
    setInputs(produce(inputs, (draft) => {
      draft.parameters = {
        ...draft.parameters,
        [key]: value,
      }
    }))
  }

  const parameters = inputs.parameters || {}

  return (
    <div className="space-y-4 px-4 pt-2 pb-4">
      <Field title={t('pololu.operation', { ns: 'workflow' })}>
        <TypeSelector
          options={operationOptions}
          value={inputs.operation}
          onChange={updateOperation}
          readonly={nodesReadOnly}
          popupClassName="w-[180px]"
        />
      </Field>
      {inputs.operation === PololuOperation.setMotors && (
        <div className="grid grid-cols-2 gap-3">
          <Field title={t('pololu.leftSpeed', { ns: 'workflow' })}>
            <Input disabled={nodesReadOnly} value={`${parameters.left ?? 0}`} onChange={event => updateParameter('left', toNumber(event.target.value))} />
          </Field>
          <Field title={t('pololu.rightSpeed', { ns: 'workflow' })}>
            <Input disabled={nodesReadOnly} value={`${parameters.right ?? 0}`} onChange={event => updateParameter('right', toNumber(event.target.value))} />
          </Field>
        </div>
      )}
      {inputs.operation === PololuOperation.wait && (
        <Field title={t('pololu.seconds', { ns: 'workflow' })}>
          <Input disabled={nodesReadOnly} value={`${parameters.seconds ?? 0}`} onChange={event => updateParameter('seconds', toNumber(event.target.value))} />
        </Field>
      )}
      {inputs.operation === PololuOperation.displayText && (
        <>
          <Field title={t('pololu.text', { ns: 'workflow' })}>
            <Input disabled={nodesReadOnly} value={`${parameters.text ?? ''}`} onChange={event => updateParameter('text', event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field title="X">
              <Input disabled={nodesReadOnly} value={`${parameters.x ?? 0}`} onChange={event => updateParameter('x', toNumber(event.target.value))} />
            </Field>
            <Field title="Y">
              <Input disabled={nodesReadOnly} value={`${parameters.y ?? 0}`} onChange={event => updateParameter('y', toNumber(event.target.value))} />
            </Field>
          </div>
        </>
      )}
      {inputs.operation === PololuOperation.yellowLed && (
        <Field title={t('pololu.state', { ns: 'workflow' })}>
          <TypeSelector
            options={[
              { value: 'true', label: t('pololu.node.on', { ns: 'workflow' }) },
              { value: 'false', label: t('pololu.node.off', { ns: 'workflow' }) },
            ]}
            value={parameters.on ? 'true' : 'false'}
            onChange={(value: string) => updateParameter('on', value === 'true')}
            readonly={nodesReadOnly}
          />
        </Field>
      )}
      {inputs.operation === PololuOperation.rgbLed && (
        <>
          <Field title={t('pololu.ledIndex', { ns: 'workflow' })}>
            <Input disabled={nodesReadOnly} value={`${parameters.led ?? 0}`} onChange={event => updateParameter('led', toNumber(event.target.value))} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field title="R">
              <Input disabled={nodesReadOnly} value={`${parameters.red ?? 0}`} onChange={event => updateParameter('red', toNumber(event.target.value))} />
            </Field>
            <Field title="G">
              <Input disabled={nodesReadOnly} value={`${parameters.green ?? 0}`} onChange={event => updateParameter('green', toNumber(event.target.value))} />
            </Field>
            <Field title="B">
              <Input disabled={nodesReadOnly} value={`${parameters.blue ?? 0}`} onChange={event => updateParameter('blue', toNumber(event.target.value))} />
            </Field>
          </div>
        </>
      )}
    </div>
  )
}

export default memo(PololuActionPanel)
