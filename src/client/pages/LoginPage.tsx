import React, { useState, useEffect } from 'react';
import { Phone, LogIn, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PinKeypad } from '../components/PinKeypad';
import { api } from '../lib/api';

interface DemoAccount {
  role: string;
  name: string;
  phone: string;
  rawPhone: string;
  organization: string;
  badge: string;
  pin: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [phone, setPhone] = useState('77 123 45 67');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    api
      .get<DemoAccount[]>('/api/auth/demo-accounts')
      .then(setDemoAccounts)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone.trim()) {
      setError('Veuillez renseigner votre numéro de téléphone');
      return;
    }
    if (pin.length !== 4) {
      setError('Le code PIN doit comporter 4 chiffres');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(phone, pin);
    } catch (err: any) {
      setError(err?.message || 'Identifiants invalides');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soumission automatique lorsque le 4ème chiffre est entré
  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    if (newPin.length === 4 && phone.trim() && !isSubmitting) {
      setTimeout(() => {
        setIsSubmitting(true);
        setError(null);
        login(phone, newPin).catch((err: any) => {
          setError(err?.message || 'Code PIN incorrect');
          setPin('');
          setIsSubmitting(false);
        });
      }, 150);
    }
  };

  const handleSelectDemo = (account: DemoAccount) => {
    setPhone(account.phone);
    setPin(account.pin);
    setError(null);
    setIsSubmitting(true);
    login(account.rawPhone, account.pin).catch((err: any) => {
      setError(err?.message || 'Erreur de connexion');
      setPin('');
      setIsSubmitting(false);
    });
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-on-surface flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Texture industrielle d'arrière-plan */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255, 140, 0, 0.12) 0%, transparent 60%), linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8))',
        }}
      />

      {/* Carte principale d'authentification */}
      <div className="w-full max-w-md p-6 md:p-8 bg-surface border border-[#334155] rounded-xl flex flex-col gap-6 relative z-10 shadow-2xl">
        {/* En-tête */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-sm bg-[#ff8c00]"></span>
            <h1 className="font-mono text-3xl font-bold tracking-tight text-[#ffb77d]">LogiCam.io</h1>
          </div>
          <p className="font-sans text-sm text-on-surface-variant">
            Plateforme Industrielle de Gestion de Flotte
          </p>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Champ Téléphone */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface" htmlFor="phone">
              Numéro de téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="77 123 45 67"
                disabled={isSubmitting}
                className="w-full bg-[#020617] border border-[#334155] rounded focus:outline-none pl-10 pr-3 py-2.5 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
              />
            </div>
          </div>

          {/* Saisie PIN */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface">
              Code PIN (4 chiffres)
            </label>
            <PinKeypad pin={pin} onChange={handlePinChange} disabled={isSubmitting} />
          </div>

          {/* Bouton de Connexion */}
          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="w-full bg-[#ff8c00] hover:bg-[#ff8c00]/90 active:scale-[0.99] text-black font-mono font-semibold text-sm py-3 rounded flex items-center justify-center gap-2 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,140,0,0.3)]"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        {/* Badge Sécurisé */}
        <div className="flex items-center justify-center gap-2 text-[#4edea3] bg-[#4edea3]/10 py-1.5 rounded-full border border-[#4edea3]/20">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-wider">Connexion Sécurisée</span>
        </div>

        {/* Comptes de Démo rapide en 1 clic */}
        {demoAccounts.length > 0 && (
          <div className="border-t border-[#334155] pt-4 flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant text-center">
              Accès Rapide Démo (PIN : 1234)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.phone}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  disabled={isSubmitting}
                  className="p-2 rounded bg-surface-container hover:bg-surface-variant border border-[#334155] text-left transition-colors flex flex-col gap-0.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-on-surface group-hover:text-primary">
                      {acc.badge}
                    </span>
                    <Lock className="w-3 h-3 text-on-surface-variant" />
                  </div>
                  <span className="text-xs text-on-surface-variant truncate">{acc.name}</span>
                  <span className="font-mono text-[10px] text-primary truncate">
                    {acc.organization}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
