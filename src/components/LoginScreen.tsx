'use client';

import React, { useState } from 'react';
import {
  HeartPulse,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { SessionUser } from '@/lib/types';

interface LoginScreenProps {
  onLoginSuccess: (user: SessionUser, lanUrls: string[]) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (u: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: u,
          password: p,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas.');
      } else {
        onLoginSuccess(data.user, data.lanUrls || []);
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#F7F8F6] p-4">
      <div className="w-full max-w-sm bg-white border border-[#E4E9E5] rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-[#F2F5F3]">
          <div className="w-11 h-11 rounded-2xl bg-[#3D6B5E] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <HeartPulse className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#26302D]">VitaliMarket & Café</h1>
          <p className="text-xs text-[#5C6B66] mt-0.5">
            Tienda y Cafetería Hospitalaria • Acceso al Sistema
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-[#FCEEED] border border-[#EBC7C3] text-[#A84A3E] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#26302D] mb-1">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. operador o admin"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-sm focus:outline-none focus:border-[#3D6B5E]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#26302D] mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-sm focus:outline-none focus:border-[#3D6B5E]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3D6B5E] text-white font-semibold text-sm hover:bg-[#2F574B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Quick Access Role Helper */}
        <div className="px-5 pb-5 pt-1">
          <div className="p-3 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] space-y-2">
            <p className="text-[11px] font-medium text-[#5C6B66] text-center">
              Acceso rápido de prueba por rol:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setUsername('operador');
                  setPassword('caja123');
                  performLogin('operador', 'caja123');
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-[#DCE2DD] hover:border-[#3D6B5E] text-xs transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1 font-semibold text-[#26302D]">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#3D6B5E]" />
                  Operador
                </span>
                <span className="text-[10px] text-[#6B7A74]">operador / caja123</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                  performLogin('admin', 'admin123');
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-[#DCE2DD] hover:border-[#3D6B5E] text-xs transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1 font-semibold text-[#26302D]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3D6B5E]" />
                  Administrador
                </span>
                <span className="text-[10px] text-[#6B7A74]">admin / admin123</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
