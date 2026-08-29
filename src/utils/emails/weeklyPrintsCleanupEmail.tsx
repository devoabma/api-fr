// biome-ignore lint/correctness/noUnusedImports: <false positive>
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Tailwind, Text } from 'react-email'

export type WeeklyPrintsCleanupStatus =
  // Tudo que estava na fila foi removido (inclusive quando não havia nada a remover).
  | 'success'
  // O job rodou, mas parte dos lotes ficou para trás (Storage recusou a remoção, por exemplo).
  | 'partial'
  // O job estourou antes de terminar: nada garante que a fila esteja limpa.
  | 'failed'
  // A janela da sexta passou sem limpeza (API fora do ar) e a fila continua com registros antigos.
  | 'pending'

type WeeklyPrintsCleanupEmailProps = {
  status: WeeklyPrintsCleanupStatus
  totalFound: number
  deletedCount: number
  failedCount: number
  runAt: string
  link: string
  errorMessage?: string
}

const STATUS_CONFIG: Record<
  WeeklyPrintsCleanupStatus,
  {
    accent: string
    badgeBg: string
    badgeBorder: string
    badgeText: string
    label: string
    heading: string
    preview: string
    summary: string
  }
> = {
  success: {
    accent: '#16A34A',
    badgeBg: '#F0FDF4',
    badgeBorder: '#BBF7D0',
    badgeText: '#166534',
    label: '✅ Concluída',
    heading: 'Limpeza semanal concluída',
    preview: 'A limpeza semanal das impressões foi concluída com sucesso.',
    summary: 'A fila de impressões foi esvaziada normalmente. Nenhuma ação é necessária.',
  },
  partial: {
    accent: '#D97706',
    badgeBg: '#FEFCE8',
    badgeBorder: '#FDE68A',
    badgeText: '#92400E',
    label: '⚠️ Parcial',
    heading: 'Limpeza semanal concluída parcialmente',
    preview: 'A limpeza semanal terminou, mas parte das impressões não pôde ser removida.',
    summary:
      'Parte dos arquivos não pôde ser removida do Storage e os registros correspondentes foram mantidos de propósito, para tentar de novo na próxima execução.',
  },
  failed: {
    accent: '#DC2626',
    badgeBg: '#FEF2F2',
    badgeBorder: '#FECACA',
    badgeText: '#991B1B',
    label: '❌ Falhou',
    heading: 'Falha na limpeza semanal',
    preview: 'A limpeza semanal das impressões falhou e precisa de verificação.',
    summary:
      'A execução foi interrompida por um erro. A fila pode ter ficado incompleta e precisa ser verificada manualmente.',
  },
  pending: {
    accent: '#DC2626',
    badgeBg: '#FEF2F2',
    badgeBorder: '#FECACA',
    badgeText: '#991B1B',
    label: '🚨 Não executada',
    heading: 'Limpeza semanal não foi executada',
    preview: 'A limpeza semanal não aconteceu na sexta-feira e a fila continua com impressões antigas.',
    summary:
      'Ao subir, a API encontrou impressões anteriores à última sexta-feira ainda na fila. O mais provável é que a API estivesse fora do ar no horário agendado.',
  },
}

export default function WeeklyPrintsCleanupEmail({
  status,
  totalFound,
  deletedCount,
  failedCount,
  runAt,
  link,
  errorMessage,
}: WeeklyPrintsCleanupEmailProps) {
  const config = STATUS_CONFIG[status]

  const currentYear = new Date().getFullYear()

  return (
    <Html>
      <Head />

      <Preview>{config.preview}</Preview>

      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-10 font-sans">
          <Container className="mx-auto max-w-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            {/* Header */}
            <Section className="px-8 pt-12 pb-6 text-center">
              <Text className="m-0 font-bold text-lg uppercase" style={{ color: config.accent }}>
                Sala Livre
              </Text>

              <Heading className="m-0 mt-4 font-bold text-lg text-slate-900">{config.heading}</Heading>

              <Text className="mx-auto mt-4 max-w-md text-base text-slate-600 leading-7">
                Relatório automático da limpeza de impressões, executada toda sexta-feira às 23:59.
              </Text>
            </Section>

            {/* Status */}
            <Section className="px-8">
              <Section
                style={{
                  backgroundColor: config.badgeBg,
                  border: `1px solid ${config.badgeBorder}`,
                  borderRadius: '16px',
                  padding: '24px',
                }}
              >
                <Text className="m-0 text-center font-bold text-base" style={{ color: config.badgeText }}>
                  {config.label}
                </Text>

                <Text className="m-0 mt-3 text-center text-sm leading-6" style={{ color: config.badgeText }}>
                  {config.summary}
                </Text>
              </Section>
            </Section>

            {/* Números */}
            <Section className="px-8 py-4">
              <Section className="my-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <Text className="mb-5 font-bold text-slate-500 text-xs uppercase tracking-[2px]">Resumo da Execução</Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>Impressões na fila:</strong> {totalFound}
                </Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>Removidas:</strong> {deletedCount}
                </Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>Não removidas:</strong> {failedCount}
                </Text>

                <Hr className="my-4 border-slate-200" />

                <Text className="m-0 py-2 text-slate-700">
                  <strong>Data da verificação:</strong> {runAt}
                </Text>
              </Section>

              {errorMessage ? (
                <Section
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderLeft: '4px solid #DC2626',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <Text className="m-0 font-bold text-slate-700 text-sm">Detalhes do erro</Text>

                  <Text
                    className="m-0 mt-2 text-slate-700 text-sm leading-6"
                    style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                  >
                    {errorMessage}
                  </Text>
                </Section>
              ) : null}

              {status !== 'success' ? (
                <Section
                  style={{
                    backgroundColor: '#FEFCE8',
                    borderLeft: '4px solid #EAB308',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '16px',
                  }}
                >
                  <Text className="m-0 text-slate-700 text-sm leading-6">
                    <strong>O que fazer:</strong> confira se a API está no ar e se o Storage está respondendo. As impressões
                    pendentes continuam no banco e serão reprocessadas na próxima execução do job.
                  </Text>
                </Section>
              ) : null}

              {/* CTA */}
              <Section className="py-10 text-center">
                <Button
                  href={link}
                  style={{
                    backgroundColor: config.accent,
                    color: '#FFFFFF',
                    padding: '16px 32px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '16px',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Acessar Plataforma
                </Button>
              </Section>
            </Section>

            {/* Footer */}
            <Section className="mt-8 border-slate-200 border-t bg-slate-50 px-8 py-8">
              <Text className="m-0 text-center text-slate-500 text-sm">
                Este é um e-mail automático. Não responda esta mensagem.
              </Text>

              <Text className="mt-5 text-center text-slate-400 text-xs">
                © {currentYear} Sala Livre. Todos os direitos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

WeeklyPrintsCleanupEmail.PreviewProps = {
  status: 'partial',
  totalFound: 128,
  deletedCount: 100,
  failedCount: 28,
  runAt: '29/08/2026 às 23:59:59',
  link: 'https://salalivre.oabma.org.br',
  errorMessage: 'Storage: Object not found (lote 2 de 2).',
} satisfies WeeklyPrintsCleanupEmailProps
