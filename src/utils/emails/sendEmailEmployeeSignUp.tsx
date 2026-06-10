// biome-ignore lint/correctness/noUnusedImports: <false-positive>
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Tailwind, Text } from 'react-email'

type EmployeeSignUpEmailProps = {
  name: string
  cpf: string
  email: string
  tempPassword: string
  link: string
}

export default function SendEmailEmployeeSignUp({ name, cpf, email, tempPassword, link }: EmployeeSignUpEmailProps) {
  const currentYear = new Date().getFullYear()
  const sendDate = new Date().toLocaleDateString('pt-BR')

  return (
    <Html>
      <Head />

      <Preview>Sua conta no Sala Livre foi criada com sucesso. Acesse agora e altere sua senha temporária.</Preview>

      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-10 font-sans">
          <Container className="mx-auto max-w-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            {/* Header */}
            <Section className="px-8 pt-8 pb-2 text-center">
              <Text className="m-0 font-bold text-indigo-600 text-lg uppercase">Sala Livre</Text>

              <Heading className="m-0 mt-4 font-bold text-lg text-slate-900">Bem-vindo(a)!</Heading>

              <Text className="mx-auto mt-4 max-w-md text-base text-slate-600 leading-7">
                Sua conta foi criada com sucesso. Utilize os dados abaixo para acessar a plataforma.
              </Text>
            </Section>

            {/* Conteúdo */}
            <Section className="px-8 py-4">
              <Text className="text-base text-slate-700 leading-7">
                Olá, <strong>{name}</strong>.
              </Text>

              <Text className="text-base text-slate-700 leading-7">
                Ficamos felizes em ter você conosco. Antes de começar, confira suas informações de acesso:
              </Text>

              {/* Dados */}
              <Section className="my-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <Text className="mb-5 font-bold text-slate-500 text-xs uppercase tracking-[2px]">Dados de Acesso</Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>Nome:</strong> {name}
                </Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>CPF:</strong> {cpf}
                </Text>

                <Text className="m-0 py-2 text-slate-700">
                  <strong>E-mail:</strong> {email}
                </Text>

                <Hr className="my-5 border-slate-200" />

                <Text className="mb-3 font-semibold text-slate-700 text-sm">Senha Temporária</Text>

                <Section
                  style={{
                    backgroundColor: '#0F172A',
                    borderRadius: '12px',
                    padding: '18px',
                    textAlign: 'center',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      color: '#FFFFFF',
                      fontSize: '20px',
                      fontWeight: '700',
                      letterSpacing: '2px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {tempPassword}
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
                  <strong>Importante:</strong> por segurança, esta senha é temporária. Após o primeiro acesso, altere sua senha
                  para uma nova senha de sua preferência.
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
                className="text-center text-indigo-600 text-sm"
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

// Preview
SendEmailEmployeeSignUp.PreviewProps = {
  name: 'Maria Silva',
  cpf: '123.456.789-09',
  email: 'maria.silva@oabma.org.br',
  tempPassword: 'Abc@1234',
  link: 'https://salalivre.oabma.org.br/sign-in',
} satisfies EmployeeSignUpEmailProps
