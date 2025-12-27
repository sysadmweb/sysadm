import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Shield, User as UserIcon, ArrowLeft } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import * as bcrypt from "bcryptjs";

export default function CadastrarUsuario() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    is_super_user: false,
  });

  useEffect(() => { }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const payload = {
        username: formData.username.trim().toUpperCase(),
        password: formData.password,
        name: formData.name.trim().toUpperCase(),
        is_super_user: !!formData.is_super_user,
      };
      if (payload.password.length < 4) {
        setError("A senha deve ter pelo menos 4 caracteres");
        return;
      }
      const pwHash = await bcrypt.hash(payload.password, 10);
      const { error } = await supabase
        .from("usuarios")
        .insert({
          username: payload.username,
          password_hash: pwHash,
          name: payload.name,
          is_super_user: payload.is_super_user,
          is_active: true,
        });
      if (error) {
        setError("Falha ao salvar");
        return;
      }
      navigate("/users");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser?.is_super_user) {
    return (
      <div className="max-w-md mx-auto bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mt-10">
        <div className="flex items-center gap-2 text-yellow-400 mb-4">
          <Shield className="w-5 h-5" />
          <span>Acesso permitido apenas para Super Usuário</span>
        </div>
        <button
          onClick={() => navigate("/users")}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Novo Usuário</h1>
          <p className="text-slate-400 mt-1">Cadastre um novo usuário no sistema</p>
        </div>
        <button
          onClick={() => navigate("/users")}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Usuário</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase() })}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                placeholder="Digite o usuário"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              placeholder="Digite a senha"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              placeholder="Digite o nome"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Usuário</label>
            <select
              value={formData.is_super_user ? "super" : "regular"}
              onChange={(e) => setFormData({ ...formData, is_super_user: e.target.value === "super" })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            >
              <option value="regular">Usuário Comum</option>
              <option value="super">Super Usuário</option>
            </select>
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/users")}
              className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}