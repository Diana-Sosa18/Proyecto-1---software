import { useMemo, useState, type FormEvent } from "react";
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { rolePaths } from "@/routes/rolePaths";

type LoginErrors = {
  email?: string;
  password?: string;
};

export function LoginView() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleHints = useMemo(
    () => ["Administrador", "Guardia", "Residente", "Inquilino"],
    [],
  );

  const validate = () => {
    const nextErrors: LoginErrors = {};

    if (!email.trim()) {
      nextErrors.email = "El correo es obligatorio.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = "Ingrese un correo valido.";
    }

    if (!password.trim()) {
      nextErrors.password = "La contrasena es obligatoria.";
    } else if (password.trim().length < 4) {
      nextErrors.password = "La contrasena debe tener al menos 4 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      navigate(rolePaths[response.role], { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No fue posible iniciar sesion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <section
        className="relative hidden w-1/2 overflow-hidden lg:flex"
        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_30%)]" />
        <div className="relative z-10 flex w-full flex-col justify-center px-12 text-white">
          <Building2 size={96} strokeWidth={1.5} className="mb-8 opacity-90" />
          <h2 className="text-4xl">Bienvenido a NexusResidencial</h2>
          <p className="mt-4 max-w-md text-lg text-blue-100">
            Plataforma unificada para acceso, operacion y experiencia de la comunidad residencial.
          </p>

          <div className="mt-12 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <p className="text-3xl">24/7</p>
              <p className="mt-2 text-sm text-blue-100">Acceso continuo</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <p className="text-3xl">1 sola app</p>
              <p className="mt-2 text-sm text-blue-100">Experiencia unificada</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <Building2 size={42} className="mr-3 text-[#1E3A8A]" />
            <div>
              <h1 className="text-[#1E3A8A]">NexusResidencial</h1>
              <p className="text-sm text-slate-500">Gestion inteligente residencial</p>
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200 shadow-xl">
            <CardContent className="p-8">
              <div className="mb-8">
                <div className="mb-6 hidden items-center lg:flex">
                  <Building2 size={40} className="mr-3 text-[#1E3A8A]" />
                  <div>
                    <h1 className="text-[#1E3A8A]">NexusResidencial</h1>
                    <p className="text-sm text-slate-500">Gestion inteligente residencial</p>
                  </div>
                </div>

                <h2 className="text-2xl text-slate-900">Iniciar sesion</h2>
                <p className="mt-2 text-slate-500">Ingrese sus credenciales para acceder al panel correspondiente.</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {serverError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Acceso denegado</AlertTitle>
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                ) : null}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm text-slate-700">
                    Correo electronico
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-11"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  {errors.email ? <p className="mt-2 text-sm text-red-600">{errors.email}</p> : null}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm text-slate-700">
                    Contrasena
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="px-11"
                      placeholder="Ingrese su contrasena"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {errors.password ? <p className="mt-2 text-sm text-red-600">{errors.password}</p> : null}
                </div>

                <Button type="submit" className="h-11 w-full bg-[#1E3A8A] hover:bg-[#2563EB]" disabled={isSubmitting}>
                  {isSubmitting ? "Validando..." : "Ingresar"}
                </Button>

                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-center text-xs text-slate-400">Acceso disponible para</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {roleHints.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-slate-400">
            © 2026 NexusResidencial. Todos los derechos reservados.
          </p>
        </div>
      </section>
    </div>
  );
}




