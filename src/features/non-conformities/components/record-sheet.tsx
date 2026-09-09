import { formatDate, formatDateTime } from '@/utils/date'
import {
  recordStatusLabels,
  recordTypeLabels,
  verificationMethodLabels,
  verificationMethods,
} from '@/features/non-conformities/schemas'

import type { ReactNode } from 'react'
import type { RecordDetail } from '@/features/non-conformities/types'

const DOCUMENT_CODE = 'RQ-0XX'
const DOCUMENT_REVISION = '00'
const DOCUMENT_ISSUE_DATE = '30/06/2016'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-black/60 bg-black/5 px-2 py-1 text-[11px] font-bold uppercase">
      {children}
    </div>
  )
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-black/60 px-2 py-2 text-[11px] whitespace-pre-wrap">
      {children || '—'}
    </div>
  )
}

export function RecordSheet({ record }: { record: RecordDetail }) {
  return (
    <article className="print-sheet mx-auto w-full max-w-[210mm] border border-black/60 bg-white text-black shadow-sm">
      <header className="grid grid-cols-[120px_1fr_180px] border-b border-black/60">
        <div className="grid place-items-center border-r border-black/60 p-2 text-center text-[10px] font-bold">
          AUSTER
        </div>
        <div className="flex flex-col justify-center border-r border-black/60 p-2 text-center">
          <span className="text-[10px] font-semibold uppercase">
            Registro da Qualidade
          </span>
          <span className="text-[12px] font-bold uppercase">
            Registro de não conformidade, ação corretiva ou preventiva
          </span>
        </div>
        <div className="divide-y divide-black/60 text-[10px]">
          <div className="px-2 py-1">Data emissão / rev.: {DOCUMENT_ISSUE_DATE}</div>
          <div className="px-2 py-1">Revisão: {DOCUMENT_REVISION}</div>
          <div className="px-2 py-1">Código: {DOCUMENT_CODE}</div>
        </div>
      </header>

      <div className="flex items-stretch text-[11px]">
        <div className="flex-1 px-2 py-1">
          <span className="font-semibold">
            Nº RACP (preenchido pelo RT ou Gerente Geral):
          </span>{' '}
          <span className="font-mono">{record.number}</span>
        </div>
        <div className="w-64 divide-y divide-black/60 border-l border-black/60">
          {(['PREVENTIVE', 'CORRECTIVE'] as const).map((type) => (
            <div key={type} className="px-2 py-1">
              {recordTypeLabels[type]} ({record.type === type ? 'X' : '  '})
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>1. Definição do problema</SectionTitle>
      <Body>{record.problemDescription}</Body>
      <div className="grid grid-cols-2 divide-x divide-black/60 border-t border-black/60 text-[11px]">
        <div className="px-2 py-1">
          <span className="font-semibold">Data:</span>{' '}
          {formatDate(record.problemDate)}
        </div>
        <div className="px-2 py-1">
          <span className="font-semibold">Origem:</span> {record.origin}
        </div>
      </div>

      <SectionTitle>
        2. Pré-análise da causa e ação de contenção (ação de contenção)
      </SectionTitle>
      <Body>{record.containmentAction}</Body>

      <SectionTitle>3. Análise da causa raiz</SectionTitle>
      <Body>{record.rootCauseAnalysis}</Body>

      <SectionTitle>4. Ação a ser tomada</SectionTitle>
      <table className="w-full border-t border-black/60 text-[11px]">
        <thead>
          <tr className="bg-black/5">
            <th className="border-r border-black/60 px-2 py-1 text-left">O que?</th>
            <th className="border-r border-black/60 px-2 py-1 text-left">Quem?</th>
            <th className="w-24 border-r border-black/60 px-2 py-1 text-left">
              Quando?
            </th>
            <th className="w-32 px-2 py-1 text-left">Onde?</th>
          </tr>
        </thead>
        <tbody>
          {record.actions.length === 0 && (
            <tr className="border-t border-black/60">
              <td className="px-2 py-3 text-center" colSpan={4}>
                —
              </td>
            </tr>
          )}
          {record.actions.map((action) => (
            <tr key={action.id} className="border-t border-black/60 align-top">
              <td className="border-r border-black/60 px-2 py-1 whitespace-pre-wrap">
                {action.what}
                {action.completedAt && (
                  <span className="block text-[9px]">
                    Concluída em {formatDate(action.completedAt)}
                  </span>
                )}
              </td>
              <td className="border-r border-black/60 px-2 py-1">{action.who}</td>
              <td className="border-r border-black/60 px-2 py-1">
                {formatDate(action.dueDate)}
              </td>
              <td className="px-2 py-1">{action.where}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>5. Método de verificação da eficácia</SectionTitle>
      <div className="flex flex-wrap gap-4 border-t border-black/60 px-2 py-1 text-[11px]">
        {verificationMethods.map((method) => (
          <span key={method}>
            ({record.verificationMethod === method ? 'X' : '  '}){' '}
            {verificationMethodLabels[method]}
            {method === 'OTHER' && record.verificationMethod === 'OTHER'
              ? `: ${record.verificationMethodDetail ?? ''}`
              : ''}
          </span>
        ))}
      </div>

      <SectionTitle>6. Verificação da eficácia</SectionTitle>
      <Body>{record.effectivenessResult}</Body>
      <div className="grid grid-cols-2 divide-x divide-black/60 border-t border-black/60 text-[11px]">
        <div className="px-2 py-1">
          <span className="font-semibold">Data:</span>{' '}
          {formatDate(record.effectivenessDate)}
        </div>
        <div className="px-2 py-1">
          <span className="font-semibold">Responsável:</span>{' '}
          {record.effectivenessVerifiedBy?.name ?? '—'}
        </div>
      </div>

      <SectionTitle>7. Ciência dos envolvidos</SectionTitle>
      <table className="w-full border-t border-black/60 text-[11px]">
        <thead>
          <tr className="bg-black/5">
            <th className="border-r border-black/60 px-2 py-1 text-left">Nome</th>
            <th className="border-r border-black/60 px-2 py-1 text-left">Cargo</th>
            <th className="w-24 border-r border-black/60 px-2 py-1 text-left">
              Data
            </th>
            <th className="w-44 px-2 py-1 text-left">Assinatura</th>
          </tr>
        </thead>
        <tbody>
          {record.acknowledgements.length === 0 && (
            <tr className="border-t border-black/60">
              <td className="px-2 py-3 text-center" colSpan={4}>
                —
              </td>
            </tr>
          )}
          {record.acknowledgements.map((entry) => (
            <tr key={entry.id} className="border-t border-black/60">
              <td className="border-r border-black/60 px-2 py-1">{entry.name}</td>
              <td className="border-r border-black/60 px-2 py-1">
                {entry.position}
              </td>
              <td className="border-r border-black/60 px-2 py-1">
                {formatDate(entry.acknowledgedAt)}
              </td>
              <td className="px-2 py-1 text-[9px]">
                {entry.acknowledgedAt
                  ? `Ciência eletrônica ${formatDateTime(entry.acknowledgedAt)}`
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 divide-x divide-black/60 border-t border-black/60 text-[11px]">
        <SignatureCell
          title="Responsável técnico"
          name={record.technicalManager?.name}
          signedAt={record.technicalManagerSignedAt}
        />
        <SignatureCell
          title="Gerente geral"
          name={record.generalManager?.name}
          signedAt={record.generalManagerSignedAt}
        />
      </div>

      <footer className="border-t border-black/60 px-2 py-2 text-[9px]">
        <p>
          Situação: {recordStatusLabels[record.status]} · Departamento:{' '}
          {record.department.name} · Aberto por {record.createdBy.name} em{' '}
          {formatDateTime(record.createdAt)}
          {record.closedAt
            ? ` · Encerrado em ${formatDateTime(record.closedAt)}`
            : ''}
        </p>
        <p>
          Documento original arquivado no Sistema de Gestão da Qualidade. Versão
          impressa válida somente com as assinaturas eletrônicas registradas
          acima.
        </p>
      </footer>
    </article>
  )
}

function SignatureCell({
  title,
  name,
  signedAt,
}: {
  title: string
  name: string | undefined
  signedAt: Date | null
}) {
  return (
    <div className="space-y-6 px-2 py-3 text-center">
      <div className="min-h-10 text-[10px]">
        {signedAt ? (
          <>
            <span className="block font-semibold">{name}</span>
            <span className="block">
              Assinado eletronicamente em {formatDateTime(signedAt)}
            </span>
          </>
        ) : (
          <span className="block">{name ?? ''}</span>
        )}
      </div>
      <div className="border-t border-black/60 pt-1 text-[10px] font-semibold">
        {title}
      </div>
    </div>
  )
}
