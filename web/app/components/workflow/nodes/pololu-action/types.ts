import type { CommonNodeType } from '@/app/components/workflow/types'

export const PololuOperation = {
  buzzerBeep: 'buzzer_beep',
  displayText: 'display_text',
  rgbLed: 'rgb_led',
  setMotors: 'set_motors',
  stopMotors: 'stop_motors',
  wait: 'wait',
  yellowLed: 'yellow_led',
} as const

export type PololuOperation = typeof PololuOperation[keyof typeof PololuOperation]

export type PololuActionNodeType = CommonNodeType & {
  operation: PololuOperation
  parameters: Record<string, number | string | boolean>
  statement_id?: string
}
