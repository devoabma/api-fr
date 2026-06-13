// biome-ignore lint/correctness/noUnusedImports: <false positive>
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Tailwind, Text } from 'react-email'

type ResetPasswordEmailProps = {
  name: string
  code: string
  link: string
}

export default function ResetPasswordEmail({ name, code, link }: ResetPasswordEmailProps) {
  const currentYear = new Date().getFullYear()
  const sendDate = new Date().toLocaleDateString('pt-BR')

  return (
    <Html>
      <Head />

      <Preview>Recebemos uma solicitação para redefinir sua senha no Sala Livre.</Preview>

      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-10 font-sans">
          <Container className="mx-auto max-w-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            {/* Header */}
            <Section className="px-8 pt-8 pb-2 text-center">
              <Text className="m-0 font-bold text-indigo-600 text-lg uppercase">Sala Livre</Text>

              <Heading className="m-0 mt-4 font-bold text-lg text-slate-900">Redefinição de Senha</Heading>

              <Text className="mx-auto mt-4 max-w-md text-base text-slate-600 leading-7">
                Recebemos uma solicitação para redefinir a senha da sua conta.
              </Text>
            </Section>

            {/* Conteúdo */}
            <Section className="px-8 py-4">
              <Text className="text-base text-slate-700 leading-7">
                Olá, <strong>{name}</strong>.
              </Text>

              <Text className="text-base text-slate-700 leading-7">
                Utilize o código abaixo para validar sua solicitação de recuperação de senha e continuar o processo com segurança.
              </Text>

              {/* Código */}
              <Section className="my-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <Text className="mb-4 text-center font-bold text-slate-500 text-xs uppercase tracking-[2px]">
                  Código de Verificação
                </Text>

                <Section
                  style={{
                    backgroundColor: '#0F172A',
                    borderRadius: '12px',
                    padding: '22px',
                    textAlign: 'center',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      color: '#FFFFFF',
                      fontSize: '32px',
                      fontWeight: '700',
                      letterSpacing: '8px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {code}
                  </Text>
                </Section>
              </Section>

              {/* Aviso */}
              <Section
                style={{
                  backgroundColor: '#FEFCE8',
                  borderLeft: '4px solid #EAB308',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <Text className="m-0 text-slate-700 text-sm leading-6">
                  <strong>Importante:</strong> nunca compartilhe este código com terceiros. Nossa equipe nunca solicitará este
                  código por telefone, WhatsApp ou e-mail.
                </Text>
                <Text className="m-0 text-slate-700 text-sm leading-6">
                  Esse código expira em <strong>5 minutos</strong>.
                </Text>
              </Section>

              {/* CTA */}
              <Section className="py-10 text-center">
                <Button
                  href={link}
                  style={{
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    padding: '16px 32px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '16px',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Redefinir Senha
                </Button>
              </Section>

              <Text className="mb-2 text-center text-slate-500 text-sm">
                Caso o botão acima não funcione, copie e cole o link abaixo:
              </Text>

              <Text
                style={{
                  wordBreak: 'break-all',
                }}
                className="text-center text-indigo-600 text-sm"
              >
                {link}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="mt-8 border-slate-200 border-t bg-slate-50 px-8 py-8">
              <Text className="m-0 text-center text-slate-500 text-sm">
                Se você não solicitou a redefinição de senha, ignore esta mensagem.
              </Text>

              <Text className="mt-5 text-center text-slate-400 text-xs">
                © {currentYear} Sala Livre. Todos os direitos reservados.
              </Text>

              <Text className="mt-2 text-center text-slate-400 text-xs">Enviado em {sendDate}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

ResetPasswordEmail.PreviewProps = {
  name: 'Maria Silva',
  code: '123456',
  link: 'https://salalivre.oabma.org.br/reset-password',
}
