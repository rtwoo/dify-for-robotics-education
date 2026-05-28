import type { NodeDefault } from '../../types'
import type { PololuActionNodeType } from './types'
import { BlockClassificationEnum } from '@/app/components/workflow/block-selector/types'
import { BlockEnum } from '@/app/components/workflow/types'
import { genNodeMetaData } from '@/app/components/workflow/utils'
import { PololuOperation } from './types'

const metaData = genNodeMetaData({
  classification: BlockClassificationEnum.Transform,
  sort: 0.2,
  type: BlockEnum.PololuAction,
})

const nodeDefault: NodeDefault<PololuActionNodeType> = {
  metaData,
  defaultValue: {
    operation: PololuOperation.setMotors,
    parameters: {
      left: 1000,
      right: 1000,
    },
  },
  checkValid(payload, t) {
    if (payload.operation === PololuOperation.setMotors) {
      const left = Number(payload.parameters?.left)
      const right = Number(payload.parameters?.right)
      const isValid = Number.isFinite(left) && Number.isFinite(right) && Math.abs(left) <= 6000 && Math.abs(right) <= 6000
      return {
        isValid,
        errorMessage: isValid ? '' : t('pololu.validation.motorSpeed', { ns: 'workflow' }),
      }
    }
    return { isValid: true }
  },
}

export default nodeDefault
