'use client';

import React, { useState } from 'react';
import {
  Users,
  Wifi,
  Plus,
  Edit3,
  ShieldCheck,
  ShoppingBag,
  Copy,
  Check,
  X,
  Power,
} from 'lucide-react';
import { CafeteriaDatabase, SessionUser, UserAccount, UserRole } from '@/lib/types';

interface UsersAndLanModuleProps {
  db: CafeteriaDatabase;
  currentUser: SessionUser;
  lanUrls: string[];
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

export default function UsersAndLanModule({
  db,
  currentUser,
  lanUrls,
  onRefresh,
}: UsersAndLanModuleProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operador');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingId(undefined);
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('operador');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingId(u.id);
    setFullName(u.fullName);
    setUsername(u.username);
    setPassword('');
    setRole(u.role);
    setError(null);
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_user',
          payload: {
            id: editingId,
            fullName,
            username,
            password,
            role,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo guardar el usuario.');
      } else {
        onRefresh(data.db);
        setModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUser = async (u: UserAccount) => {
    if (u.id === currentUser.id) return;
    const res = await fetch('/api/cafeteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_user',
        payload: { id: u.id },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onRefresh(data.db);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#26302D]">
            Usuarios, Permisos y Red Local (LAN)
          </h2>
          <p className="text-xs text-[#6B7A74]">
            Administra accesos del personal y conecta celulares o tablets dentro de la misma red.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D6B5E] text-white text-xs font-semibold hover:bg-[#2F574B] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Role Summary & LAN Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Users List (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E4E9E5] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[#26302D] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#3D6B5E]" />
              Cuentas Registradas ({db.users.length})
            </h3>
          </div>

          <div className="divide-y divide-[#F2F5F3]">
            {db.users.map((u) => (
              <div
                key={u.id}
                className="p-3.5 sm:px-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[#26302D]">{u.fullName}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.role === 'administrador'
                          ? 'bg-[#EEF5F2] text-[#2F574B]'
                          : 'bg-[#F2F5F3] text-[#5C6B66]'
                      }`}
                    >
                      {u.role === 'administrador' ? (
                        <>
                          <ShieldCheck className="w-3 h-3" /> Administrador (Acceso Total)
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3 h-3" /> Operador (Ventas e Inventario)
                        </>
                      )}
                    </span>
                    {!u.active && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FCEEED] text-[#A84A3E] text-[10px] font-semibold">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-[#6B7A74] mt-0.5">
                    Usuario: <strong className="text-[#26302D]">{u.username}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(u)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] hover:bg-[#E4E9E5] text-[#26302D] font-medium cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  {u.id !== currentUser.id && (
                    <button
                      onClick={() => handleToggleUser(u)}
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        u.active
                          ? 'bg-[#FCEEED] text-[#A84A3E] hover:bg-[#f7dedc]'
                          : 'bg-[#EEF5F2] text-[#2F574B] hover:bg-[#dcebe4]'
                      }`}
                      title={u.active ? 'Desactivar acceso' : 'Reactivar acceso'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LAN Access Instructions Card (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E9E5] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EEF5F2] text-[#3D6B5E] flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#26302D]">
                Acceso desde Red Local (LAN / Wi-Fi)
              </h3>
              <p className="text-[11px] text-[#6B7A74]">
                Abre estas direcciones en tablets, celulares u otras PCs conectadas al mismo Wi-Fi/red:
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {lanUrls.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#F7F8F6] text-xs text-[#6B7A74]">
                Conéctate a una red Wi-Fi o Ethernet para ver tu dirección IP local.
              </div>
            ) : (
              lanUrls.map((url) => (
                <div
                  key={url}
                  className="p-2.5 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] flex items-center justify-between gap-2 text-xs"
                >
                  <code className="font-semibold text-[#2F574B] break-all">{url}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#DCE2DD] text-[#26302D] hover:bg-[#EDF1EE] shrink-0 cursor-pointer"
                  >
                    {copiedUrl === url ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#2F574B]" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EDE6D8] text-[11px] text-[#5C6B66] space-y-1">
            <p className="font-semibold text-[#26302D]">Al instalar en la PC principal del local:</p>
            <p>
              1. Ejecuta una sola vez <code className="font-mono text-[#26302D]">abrir-puerto-firewall-lan.bat</code> como Administrador para permitir conexiones entrantes en el puerto 3000.
            </p>
            <p>
              2. Inicia el servicio con <code className="font-mono text-[#26302D]">iniciar-servicio-lan.bat</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Crear / Editar Usuario (max-h-[90dvh] con botones siempre visibles) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm text-[#26302D]">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {error && (
                  <div className="p-2.5 rounded-xl bg-[#FCEEED] text-[#A84A3E]">{error}</div>
                )}

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Nombre completo / Turno *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Carlos (Operador Turno Tarde)"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Usuario de ingreso *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. carlos"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    {editingId
                      ? 'Nueva contraseña (dejar vacío para no cambiar)'
                      : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    required={!editingId}
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1.5">
                    Rol y Permisos en el Sistema
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('operador')}
                      className={`text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        role === 'operador'
                          ? 'bg-[#EEF5F2] border-[#3D6B5E] text-[#26302D]'
                          : 'bg-[#F7F8F6] border-[#DCE2DD] text-[#5C6B66]'
                      }`}
                    >
                      <div className="font-semibold">Operador</div>
                      <div className="text-[11px] text-[#5C6B66]">
                        Solo tiene acceso a los módulos de Ventas e Inventarios.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('administrador')}
                      className={`text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        role === 'administrador'
                          ? 'bg-[#EEF5F2] border-[#3D6B5E] text-[#26302D]'
                          : 'bg-[#F7F8F6] border-[#DCE2DD] text-[#5C6B66]'
                      }`}
                    >
                      <div className="font-semibold">Administrador</div>
                      <div className="text-[11px] text-[#5C6B66]">
                        Acceso completo a Ventas, Inventarios, Gastos, Ganancias, Resumen y Usuarios.
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
