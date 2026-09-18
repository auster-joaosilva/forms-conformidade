import { z } from 'zod'

export const recordTypes = ['PREVENTIVE', 'CORRECTIVE'] as const
export const recordStatuses = [
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'UNDER_VERIFICATION',
  'CLOSED',
  'CANCELLED',
] as const
export const verificationMethods = [
  'DOCUMENTAL',
  'VISUAL',
  'INTERVIEW',
  'OTHER',
] as const
export const attachmentSections = [
  'ROOT_CAUSE',
  'ACTION_PLAN',
  'EFFECTIVENESS',
  'ACKNOWLEDGEMENT',
] as const

export type RecordType = (typeof recordTypes)[number]
export type RecordStatus = (typeof recordStatuses)[number]
export type VerificationMethod = (typeof verificationMethods)[number]
export type AttachmentSection = (typeof attachmentSections)[number]

export const recordTypeLabels: Record<RecordType, string> = {
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
}

export const recordStatusLabels: Record<RecordStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em execução',
  UNDER_VERIFICATION: 'Em verificação',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
}

export const verificationMethodLabels: Record<VerificationMethod, string> = {
  DOCUMENTAL: 'Documental',
  VISUAL: 'Visual',
  INTERVIEW: 'Entrevista',
  OTHER: 'Outro',
}

export const attachmentSectionLabels: Record<AttachmentSection, string> = {
  ROOT_CAUSE: '3. Análise da causa raiz',
  ACTION_PLAN: '4. Ação a ser tomada',
  EFFECTIVENESS: '6. Verificação da eficácia',
  ACKNOWLEDGEMENT: '7. Ciência dos envolvidos',
}

const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida')

const optionalDate = z
  .string()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'Informe uma data válida',
  })

export const actionSchema = z.object({
  id: z.string(),
  what: z.string().min(1, 'Descreva o que será feito'),
  who: z.string().min(1, 'Informe quem executará'),
  assigneeId: z.string(),
  dueDate: requiredDate,
  where: z.string().min(1, 'Informe onde será executado'),
  completed: z.boolean(),
})

export const acknowledgementSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1, 'Informe o nome'),
  position: z.string().min(1, 'Informe o cargo'),
})

export const recordFormSchema = z.object({
  type: z.enum(recordTypes),
  departmentId: z.string().min(1, 'Selecione o departamento'),
  problemDescription: z.string().min(1, 'Descreva o problema'),
  problemDate: requiredDate,
  origin: z.string().min(1, 'Informe a origem'),
  clientName: z.string(),
  errorResponsibleName: z.string(),
  containmentAction: z.string(),
  rootCauseAnalysis: z.string(),
  verificationMethod: z.union([z.enum(verificationMethods), z.literal('')]),
  verificationMethodDetail: z.string(),
  effectivenessResult: z.string(),
  effectivenessDate: optionalDate,
  effectivenessVerifiedById: z.string(),
  technicalManagerId: z.string(),
  generalManagerId: z.string(),
  actions: z.array(actionSchema),
  acknowledgements: z.array(acknowledgementSchema),
})

export type RecordFormValues = z.infer<typeof recordFormSchema>

export const recordFiltersSchema = z.object({
  status: z.union([z.enum(recordStatuses), z.literal('')]),
  type: z.union([z.enum(recordTypes), z.literal('')]),
  departmentId: z.string(),
  search: z.string(),
})

export type RecordFilters = z.infer<typeof recordFiltersSchema>

export const emptyRecordForm: RecordFormValues = {
  type: 'CORRECTIVE',
  departmentId: '',
  problemDescription: '',
  problemDate: new Date().toISOString().slice(0, 10),
  origin: '',
  clientName: '',
  errorResponsibleName: '',
  containmentAction: '',
  rootCauseAnalysis: '',
  verificationMethod: '',
  verificationMethodDetail: '',
  effectivenessResult: '',
  effectivenessDate: '',
  effectivenessVerifiedById: '',
  technicalManagerId: '',
  generalManagerId: '',
  actions: [],
  acknowledgements: [],
}

export const openStatuses: Array<RecordStatus> = [
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'UNDER_VERIFICATION',
]
