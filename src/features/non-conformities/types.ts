import type { inferRouterOutputs } from '@trpc/server'
import type { TRPCRouter } from '@/lib/trpc/router'
import type { RecordFormValues } from '@/features/non-conformities/schemas'

type RouterOutputs = inferRouterOutputs<TRPCRouter>

export type RecordDetail = RouterOutputs['records']['byId']
export type RecordListItem = RouterOutputs['records']['list'][number]
export type DepartmentOption = RouterOutputs['directory']['departments'][number]
export type UserOption = RouterOutputs['directory']['users'][number]

export function toFormValues(record: RecordDetail): RecordFormValues {
  const toDate = (value: Date | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : ''

  return {
    type: record.type,
    departmentId: record.departmentId,
    problemDescription: record.problemDescription,
    problemDate: toDate(record.problemDate),
    origin: record.origin,
    clientName: record.clientName ?? '',
    errorResponsibleName: record.errorResponsibleName ?? '',
    hasFinancialImpact: record.hasFinancialImpact,
    financialImpactTarget: record.financialImpactTarget ?? '',
    financialImpactAmount:
      record.financialImpactAmount != null
        ? String(record.financialImpactAmount)
        : '',
    containmentAction: record.containmentAction ?? '',
    rootCauseAnalysis: record.rootCauseAnalysis ?? '',
    verificationMethod: record.verificationMethod ?? '',
    verificationMethodDetail: record.verificationMethodDetail ?? '',
    effectivenessResult: record.effectivenessResult ?? '',
    effectivenessDate: toDate(record.effectivenessDate),
    effectivenessVerifiedById: record.effectivenessVerifiedById ?? '',
    technicalManagerId: record.technicalManagerId ?? '',
    generalManagerId: record.generalManagerId ?? '',
    actions: record.actions.map((action) => ({
      id: action.id,
      what: action.what,
      who: action.who,
      assigneeId: action.assigneeId ?? '',
      dueDate: toDate(action.dueDate),
      where: action.where,
      completed: action.completedAt !== null,
    })),
    acknowledgements: record.acknowledgements.map((entry) => ({
      id: entry.id,
      userId: entry.userId ?? '',
      name: entry.name,
      position: entry.position,
    })),
  }
}
