import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useTRPC } from '@/lib/trpc/react'
import {
  recordFormSchema,
  recordTypeLabels,
  recordTypes,
  verificationMethodLabels,
  verificationMethods,
} from '@/features/non-conformities/schemas'
import {
  Field,
  FormSection,
} from '@/features/non-conformities/components/form-section'

import type { RecordFormValues } from '@/features/non-conformities/schemas'

const NONE = '__none__'

type RecordFormProps = {
  defaultValues: RecordFormValues
  onSubmit: (values: RecordFormValues) => void
  isSubmitting: boolean
  canEditManagerFields: boolean
  disabled?: boolean
  submitLabel?: string
}

export function RecordForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  canEditManagerFields,
  disabled = false,
  submitLabel = 'Salvar registro',
}: RecordFormProps) {
  const trpc = useTRPC()
  const departments = useQuery(trpc.directory.departments.queryOptions())
  const users = useQuery(trpc.directory.users.queryOptions())

  const form = useForm<RecordFormValues>({
    resolver: standardSchemaResolver(recordFormSchema),
    defaultValues,
  })

  const actions = useFieldArray({ control: form.control, name: 'actions' })
  const acknowledgements = useFieldArray({
    control: form.control,
    name: 'acknowledgements',
  })

  const errors = form.formState.errors
  const userOptions = users.data ?? []
  const managerFieldsDisabled = disabled || !canEditManagerFields

  return (
    <form
      className="space-y-8"
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
    >
      <FormSection title="Identificação">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Tipo de registro" error={errors.type?.message}>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <RadioGroup
                  className="flex gap-6"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  {recordTypes.map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <RadioGroupItem id={`type-${type}`} value={type} />
                      <Label htmlFor={`type-${type}`} className="font-normal">
                        {recordTypeLabels[type]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </Field>

          <Field
            label="Departamento"
            error={errors.departmentId?.message}
            htmlFor="departmentId"
          >
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger id="departmentId" className="w-full">
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments.data ?? []).map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection number="1" title="Definição do problema">
        <Field
          label="Descrição"
          htmlFor="problemDescription"
          error={errors.problemDescription?.message}
        >
          <Textarea
            id="problemDescription"
            rows={5}
            disabled={disabled}
            {...form.register('problemDescription')}
          />
        </Field>
        <div className="grid gap-6 md:grid-cols-2">
          <Field
            label="Data"
            htmlFor="problemDate"
            error={errors.problemDate?.message}
          >
            <Input
              id="problemDate"
              type="date"
              disabled={disabled}
              {...form.register('problemDate')}
            />
          </Field>
          <Field label="Origem" htmlFor="origin" error={errors.origin?.message}>
            <Input
              id="origin"
              list="origin-options"
              placeholder="Auditoria interna, reclamação de cliente..."
              disabled={disabled}
              {...form.register('origin')}
            />
            <datalist id="origin-options">
              <option value="Auditoria interna" />
              <option value="Auditoria externa" />
              <option value="Reclamação de cliente" />
              <option value="Análise de indicador" />
              <option value="Observação interna" />
              <option value="Análise crítica da direção" />
            </datalist>
          </Field>
        </div>
      </FormSection>

      <FormSection
        number="2"
        title="Pré-análise da causa e ação de contenção"
        hint="Ação imediata adotada para conter o problema."
      >
        <Textarea
          rows={4}
          disabled={disabled}
          {...form.register('containmentAction')}
        />
      </FormSection>

      <FormSection
        number="3"
        title="Análise da causa raiz"
        hint="Se necessário, anexe documentos de apoio."
      >
        <Textarea
          rows={5}
          disabled={disabled}
          {...form.register('rootCauseAnalysis')}
        />
      </FormSection>

      <FormSection number="4" title="Ação a ser tomada">
        <div className="space-y-4">
          {actions.fields.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhuma ação cadastrada.
            </p>
          )}

          {actions.fields.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-12">
                <Field
                  className="md:col-span-4"
                  label="O que?"
                  error={errors.actions?.[index]?.what?.message}
                >
                  <Textarea
                    rows={2}
                    disabled={disabled}
                    {...form.register(`actions.${index}.what`)}
                  />
                </Field>

                <Field
                  className="md:col-span-3"
                  label="Quem?"
                  error={errors.actions?.[index]?.who?.message}
                >
                  <Controller
                    control={form.control}
                    name={`actions.${index}.assigneeId`}
                    render={({ field }) => (
                      <Select
                        value={field.value || NONE}
                        disabled={disabled}
                        onValueChange={(value) => {
                          const id = value === NONE ? '' : value
                          field.onChange(id)
                          const selected = userOptions.find(
                            (user) => user.id === id,
                          )
                          if (selected) {
                            form.setValue(`actions.${index}.who`, selected.name)
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Externo / outro</SelectItem>
                          {userOptions.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input
                    className="mt-2"
                    placeholder="Nome do responsável"
                    disabled={disabled}
                    {...form.register(`actions.${index}.who`)}
                  />
                </Field>

                <Field
                  className="md:col-span-2"
                  label="Quando?"
                  error={errors.actions?.[index]?.dueDate?.message}
                >
                  <Input
                    type="date"
                    disabled={disabled}
                    {...form.register(`actions.${index}.dueDate`)}
                  />
                </Field>

                <Field
                  className="md:col-span-2"
                  label="Onde?"
                  error={errors.actions?.[index]?.where?.message}
                >
                  <Input
                    disabled={disabled}
                    {...form.register(`actions.${index}.where`)}
                  />
                </Field>

                <div className="flex items-start justify-between gap-2 md:col-span-1">
                  <Controller
                    control={form.control}
                    name={`actions.${index}.completed`}
                    render={({ field }) => (
                      <div className="flex flex-col items-center gap-2 pt-8">
                        <Checkbox
                          id={`action-done-${index}`}
                          checked={field.value}
                          disabled={disabled}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                        <Label
                          htmlFor={`action-done-${index}`}
                          className="text-xs font-normal"
                        >
                          Feito
                        </Label>
                      </div>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-7"
                    disabled={disabled}
                    onClick={() => actions.remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              actions.append({
                id: '',
                what: '',
                who: '',
                assigneeId: '',
                dueDate: new Date().toISOString().slice(0, 10),
                where: '',
                completed: false,
              })
            }
          >
            <Plus className="size-4" />
            Adicionar ação
          </Button>
        </div>
      </FormSection>

      <FormSection number="5" title="Método de verificação da eficácia">
        <Controller
          control={form.control}
          name="verificationMethod"
          render={({ field }) => (
            <RadioGroup
              className="flex flex-wrap gap-6"
              value={field.value}
              onValueChange={field.onChange}
              disabled={managerFieldsDisabled}
            >
              {verificationMethods.map((method) => (
                <div key={method} className="flex items-center gap-2">
                  <RadioGroupItem id={`method-${method}`} value={method} />
                  <Label htmlFor={`method-${method}`} className="font-normal">
                    {verificationMethodLabels[method]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        {form.watch('verificationMethod') === 'OTHER' && (
          <Field label="Qual?" htmlFor="verificationMethodDetail">
            <Input
              id="verificationMethodDetail"
              disabled={managerFieldsDisabled}
              {...form.register('verificationMethodDetail')}
            />
          </Field>
        )}
      </FormSection>

      <FormSection
        number="6"
        title="Verificação da eficácia"
        hint="Preenchimento pelo gestor ou responsável técnico."
      >
        <Textarea
          rows={4}
          disabled={managerFieldsDisabled}
          {...form.register('effectivenessResult')}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Field
            label="Data"
            htmlFor="effectivenessDate"
            error={errors.effectivenessDate?.message}
          >
            <Input
              id="effectivenessDate"
              type="date"
              disabled={managerFieldsDisabled}
              {...form.register('effectivenessDate')}
            />
          </Field>
          <Field label="Responsável">
            <UserSelect
              control={form.control}
              name="effectivenessVerifiedById"
              users={userOptions}
              disabled={managerFieldsDisabled}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        number="7"
        title="Ciência dos envolvidos"
        hint="Cada envolvido registra a ciência com data e hora no próprio registro."
      >
        <div className="space-y-4">
          {acknowledgements.fields.map((item, index) => (
            <div key={item.id} className="grid gap-4 md:grid-cols-12">
              <Field
                className="md:col-span-4"
                label="Colaborador"
              >
                <Controller
                  control={form.control}
                  name={`acknowledgements.${index}.userId`}
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      disabled={disabled}
                      onValueChange={(value) => {
                        const id = value === NONE ? '' : value
                        field.onChange(id)
                        const selected = userOptions.find(
                          (user) => user.id === id,
                        )
                        if (selected) {
                          form.setValue(
                            `acknowledgements.${index}.name`,
                            selected.name,
                          )
                          form.setValue(
                            `acknowledgements.${index}.position`,
                            selected.position ?? '',
                          )
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Externo / outro</SelectItem>
                        {userOptions.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                className="md:col-span-4"
                label="Nome"
                error={errors.acknowledgements?.[index]?.name?.message}
              >
                <Input
                  disabled={disabled}
                  {...form.register(`acknowledgements.${index}.name`)}
                />
              </Field>

              <Field
                className="md:col-span-3"
                label="Cargo"
                error={errors.acknowledgements?.[index]?.position?.message}
              >
                <Input
                  disabled={disabled}
                  {...form.register(`acknowledgements.${index}.position`)}
                />
              </Field>

              <div className="flex items-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => acknowledgements.remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              acknowledgements.append({
                id: '',
                userId: '',
                name: '',
                position: '',
              })
            }
          >
            <Plus className="size-4" />
            Adicionar envolvido
          </Button>
        </div>
      </FormSection>

      <FormSection title="Assinaturas">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Responsável técnico">
            <UserSelect
              control={form.control}
              name="technicalManagerId"
              users={userOptions}
              disabled={managerFieldsDisabled}
            />
          </Field>
          <Field label="Gerente geral">
            <UserSelect
              control={form.control}
              name="generalManagerId"
              users={userOptions}
              disabled={managerFieldsDisabled}
            />
          </Field>
        </div>
      </FormSection>

      {!disabled && (
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

type UserOption = { id: string; name: string; position: string | null }

function UserSelect({
  control,
  name,
  users,
  disabled,
}: {
  control: ReturnType<typeof useForm<RecordFormValues>>['control']
  name: 'effectivenessVerifiedById' | 'technicalManagerId' | 'generalManagerId'
  users: Array<UserOption>
  disabled: boolean
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value || NONE}
          disabled={disabled}
          onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Não definido</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}
