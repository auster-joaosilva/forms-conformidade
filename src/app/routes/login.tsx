import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth-client'
import { useTRPC } from '@/lib/trpc/react'
import { paths } from '@/config/paths'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const { data: config } = useQuery(trpc.directory.authConfig.queryOptions())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<'authentik' | 'password' | null>(null)

  async function signInWithAuthentik() {
    setPending('authentik')
    const { error } = await authClient.signIn.social({
      provider: 'authentik',
      callbackURL: paths.records,
    })
    if (error) {
      setPending(null)
      toast.error(error.message ?? 'Não foi possível iniciar o login')
    }
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault()
    setPending('password')
    const { error } = await authClient.signIn.email({ email, password })
    setPending(null)
    if (error) {
      toast.error(error.message ?? 'Credenciais inválidas')
      return
    }
    await navigate({ to: paths.records })
  }

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl font-bold">
            RQ
          </span>
          <div>
            <CardTitle>Registro de Não Conformidade</CardTitle>
            <CardDescription>
              Ação corretiva ou preventiva — Sistema de Gestão da Qualidade
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {config?.authentikLoginEnabled && (
            <Button
              className="w-full"
              size="lg"
              onClick={signInWithAuthentik}
              disabled={pending !== null}
            >
              {pending === 'authentik' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Entrar com a conta Auster
            </Button>
          )}

          {config?.authentikLoginEnabled && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs uppercase">ou</span>
              <Separator className="flex-1" />
            </div>
          )}

          <form className="space-y-4" onSubmit={signInWithPassword}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={pending !== null}
            >
              {pending === 'password' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Entrar com e-mail e senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
