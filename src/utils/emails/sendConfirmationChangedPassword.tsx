// biome-ignore lint/correctness/noUnusedImports: <false positive>
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Tailwind, Text } from 'react-email'

type SendConfirmationChangedPasswordProps = {
  name: string
  link: string
}

export default function SendConfirmationChangedPassword({ name, link }: SendConfirmationChangedPasswordProps) {
  const currentYear = new Date().getFullYear()
  const sendDate = new Date().toLocaleDateString('pt-BR')

  return (
    <Html>
      <Head />

      <Preview>Sua senha foi alterada com sucesso no Sala Livre.</Preview>

      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-10 font-sans">
          <Container className="mx-auto max-w-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            {/* Header */}
            <Section className="px-8 pt-12 pb-6 text-center">
              <Text className="m-0 font-bold text-green-600 text-lg uppercase">Sala Livre</Text>

              <Heading className="m-0 mt-4 font-bold text-lg text-slate-900">Senha alterada com sucesso</Heading>

              <Text className="mx-auto mt-4 max-w-md text-base text-slate-600 leading-7">
                Confirmamos que sua senha foi atualizada com sucesso.
              </Text>
            </Section>

            {/* Conteúdo */}
            <Section className="px-8 py-4">
              <Text className="text-base text-slate-700 leading-7">
                Olá, <strong>{name}</strong>.
              </Text>

              <Text className="text-base text-slate-700 leading-7">
                Este e-mail é apenas uma confirmação de que a senha da sua conta no <strong>Sala Livre</strong> foi alterada.
              </Text>

              {/* Confirmação */}
              <Section className="my-8 rounded-2xl border border-green-200 bg-green-50 p-6">
                <Text className="m-0 text-center text-green-800">
                  ✅ Sua senha foi atualizada e já está ativa para utilização.
                </Text>
              </Section>

              {/* Alerta */}
              <Section
                style={{
                  backgroundColor: '#FEFCE8',
                  borderLeft: '4px solid #EAB308',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <Text className="m-0 text-slate-700 text-sm leading-6">
                  <strong>Atenção:</strong> se você não reconhece esta alteração, recomendamos acessar sua conta imediatamente e
                  redefinir sua senha novamente. Caso necessário, entre em contato com o suporte.
                </Text>
              </Section>

              {/* CTA */}
              <Section className="py-10 text-center">
                <Button
                  href={link}
                  style={{
                    backgroundColor: '#16A34A',
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

              <Text className="mb-2 text-center text-slate-500 text-sm">
                Caso o botão acima não funcione, copie e cole o link abaixo:
              </Text>

              <Text
                style={{
                  wordBreak: 'break-all',
                }}
                className="text-center text-green-600 text-sm"
              >
                {link}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="mt-8 border-slate-200 border-t bg-slate-50 px-8 py-8">
              <Text className="m-0 text-center text-slate-500 text-sm">
                Este é um e-mail automático. Não responda esta mensagem.
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

SendConfirmationChangedPassword.PreviewProps = {
  name: 'Maria Silva',
  link: 'https://salalivre.oabma.org.br',
}
