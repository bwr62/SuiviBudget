import React, { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { KeyRound, ShieldCheck, LifeBuoy, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: { id: string; username: string }) => void;
  hasExistingUser?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, hasExistingUser = false }) => {
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'passkey' | 'recovery'>(hasExistingUser ? 'passkey' : 'passkey');
  const [isRegistering, setIsRegistering] = useState(!hasExistingUser);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Inscription Passkey WebAuthn
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Étape 1 : Obtenir les options du serveur
      const startRes = await fetch('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || 'Erreur lors de l\'initialisation WebAuthn');
      }

      const options = await startRes.json();

      // Étape 2 : Invocation native de l'authentificateur biométrique / Passkey
      const regResponse = await startRegistration({ optionsJSON: options });

      // Étape 3 : Vérification serveur
      const finishRes = await fetch('/api/auth/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response: regResponse }),
      });

      if (!finishRes.ok) {
        const err = await finishRes.json();
        throw new Error(err.error || 'Vérification de la clé refusée');
      }

      const result = await finishRes.json();
      if (result.recoveryCode) {
        setGeneratedRecoveryCode(result.recoveryCode);
      } else {
        onSuccess(result.user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Échec de création de la Passkey');
    } finally {
      setLoading(false);
    }
  };

  // 2. Connexion Passkey WebAuthn
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const startRes = await fetch('/api/auth/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || 'Utilisateur introuvable');
      }

      const options = await startRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch('/api/auth/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response: authResponse }),
      });

      if (!finishRes.ok) {
        const err = await finishRes.json();
        throw new Error(err.error || 'Authentification refusée');
      }

      const result = await finishRes.json();
      onSuccess(result.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Échec de connexion par Passkey');
    } finally {
      setLoading(false);
    }
  };

  // 3. Connexion de secours (Argon2id)
  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), recoveryCode: recoveryCode.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Code de secours invalide');
      }

      const result = await res.json();
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du secours');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6">
        {/* En-tête */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
            <KeyRound className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            {generatedRecoveryCode
              ? 'Conservez votre code de secours'
              : isRegistering
                ? 'Configuration du compte sécurisé'
                : 'Authentification sécurisée'}
          </h2>
          <p className="text-xs text-slate-400">
            {generatedRecoveryCode
              ? 'Ce code maître ne sera affiché qu\'UNE seule fois. Notez-le soigneusement.'
              : 'Protection FIDO2 / Passkey biométrique & Chiffrement local'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Affichage du code de secours généré */}
        {generatedRecoveryCode ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 text-center space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold block">
                Code de secours maître (Argon2id)
              </span>
              <div className="font-mono text-base font-bold text-emerald-400 select-all tracking-wider">
                {generatedRecoveryCode}
              </div>
            </div>
            <button
              onClick={() => onSuccess({ id: 'active', username })}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>J'ai noté mon code et j'accède à l'application</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : mode === 'recovery' ? (
          /* Formulaire de secours */
          <form onSubmit={handleRecovery} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom d'utilisateur</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre pseudo"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Code de secours</label>
              <input
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Vérification...' : 'Déverrouiller avec le code de secours'}
            </button>

            <button
              type="button"
              onClick={() => setMode('passkey')}
              className="w-full text-xs text-slate-400 hover:text-slate-200 text-center block pt-2"
            >
              Retour à l'authentification Passkey
            </button>
          </form>
        ) : (
          /* Formulaire Passkey */
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom d'utilisateur</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: julien"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {loading
                  ? 'Communication biométrique...'
                  : isRegistering
                    ? 'Créer ma clé Passkey (WebAuthn)'
                    : 'Connexion par Passkey'}
              </span>
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-slate-400 hover:text-indigo-400"
              >
                {isRegistering ? 'Déjà configuré ? Se connecter' : 'Nouvel appareil ? Enregistrer clé'}
              </button>

              {!isRegistering && (
                <button
                  type="button"
                  onClick={() => setMode('recovery')}
                  className="text-slate-500 hover:text-amber-400 flex items-center gap-1"
                >
                  <LifeBuoy className="h-3.5 w-3.5" />
                  <span>Secours</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
