import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { MonthHeader } from './components/MonthHeader';
import { DashboardView } from './components/DashboardView';
import { TransactionsTableView } from './components/TransactionsTableView';
import { CategoriesView } from './components/CategoriesView';
import { AnalyticsView } from './components/AnalyticsView';
import { SavingsView } from './components/SavingsView';
import { BankImportModal } from './components/BankImportModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ToastContainer } from './components/ui/Toast';
import { useUIStore } from './store/useUIStore';
import { MonthlySummary, Transaction, Category } from './types';

export function App() {
  const { currentMonthYear, activeTab, autoCarryOverBalance, theme, setCurrentMonthYear, nextMonth, prevMonth } = useUIStore();
  const queryClient = useQueryClient();
  const [showBankImport, setShowBankImport] = useState(false);

  // Synchronisation du thème sur l'élément body
  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // Raccourcis clavier globaux (U3) : Alt + Flèches (Mois) & '/' ou Ctrl+F (Recherche)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si focus dans un champ texte, ignorer sauf Alt+Flèche
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        prevMonth();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        nextMonth();
        return;
      }

      if (!isInput && (e.key === '/' || (e.ctrlKey && e.key === 'f'))) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Rechercher des transactions"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextMonth, prevMonth]);

  // 1. Statut de présence d'un utilisateur
  const { data: authStatusData, isLoading: authStatusLoading } = useQuery<{ hasUser: boolean }>({
    queryKey: ['authStatus'],
    queryFn: async () => {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error('Erreur vérification statut');
      return res.json();
    },
  });

  // 2. Utilisateur connecté
  const { data: meData, isLoading: meLoading } = useQuery<{ user: { id: string; username: string } | null }>({
    queryKey: ['authMe'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) return { user: null };
      if (!res.ok) throw new Error('Erreur session utilisateur');
      return res.json();
    },
  });

  const user = meData?.user ?? null;
  const hasExistingUser = authStatusData?.hasUser ?? false;

  // 3. Statut Onboarding
  const { data: onboardingData } = useQuery<{ has_completed_onboarding: number }>({
    queryKey: ['onboardingStatus'],
    queryFn: async () => {
      const res = await fetch('/api/onboarding/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur statut onboarding');
      return res.json();
    },
    enabled: !!user,
  });

  const hasCompletedOnboarding = onboardingData ? onboardingData.has_completed_onboarding === 1 : null;

  // 4. Catégories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement catégories');
      return res.json();
    },
    enabled: !!user,
  });

  // 5. Données du mois (Summary & Transactions)
  const { data: monthData, isLoading: monthLoading } = useQuery<{
    summary: MonthlySummary;
    transactions: Transaction[];
  }>({
    queryKey: ['monthData', currentMonthYear, autoCarryOverBalance],
    queryFn: async () => {
      const url = `/api/months/${currentMonthYear}?carryOverBalance=${autoCarryOverBalance}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement données du mois');
      return res.json();
    },
    enabled: !!user,
  });

  const summary = monthData?.summary;
  const transactions = monthData?.transactions ?? [];

  // Mutations
  const addTransactionMutation = useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur création transaction');
      return res.json() as Promise<Transaction>;
    },
    onSuccess: (createdTx) => {
      if (createdTx.month_year && createdTx.month_year !== currentMonthYear) {
        setCurrentMonthYear(createdTx.month_year);
      } else {
        queryClient.invalidateQueries({ queryKey: ['monthData'] });
      }
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      scope = 'CURRENT_MONTH_ONLY',
    }: {
      id: string;
      data: Partial<Transaction>;
      scope?: 'CURRENT_MONTH_ONLY' | 'CURRENT_AND_FUTURE';
    }) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, scope }),
      });
      if (!res.ok) throw new Error('Erreur mise à jour transaction');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthData'] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      stopFutureRepetitions = false,
    }: {
      id: string;
      status: 'ACTIVE' | 'PENDING';
      stopFutureRepetitions?: boolean;
    }) => {
      const res = await fetch(`/api/transactions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, stopFutureRepetitions }),
      });
      if (!res.ok) throw new Error('Erreur changement statut');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthData'] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur suppression transaction');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthData'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => {
      queryClient.setQueryData(['authMe'], { user: null });
      queryClient.invalidateQueries();
    },
  });

  if (authStatusLoading || meLoading) {
    return (
      <div className="h-screen w-screen bg-[var(--app-bg)] flex items-center justify-center text-[var(--app-subtext)] text-sm font-mono">
        Chargement de l'environnement sécurisé...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)] antialiased font-sans">
      {/* Modal Authentification WebAuthn Passkeys */}
      {!user && (
        <AuthModal
          hasExistingUser={hasExistingUser}
          onSuccess={(loggedInUser) => {
            queryClient.setQueryData(['authMe'], { user: loggedInUser });
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
            queryClient.invalidateQueries({ queryKey: ['monthData'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
          }}
        />
      )}

      {/* Assistant de Première Connexion (Onboarding Wizard) */}
      {user && hasCompletedOnboarding === false && (
        <OnboardingWizard
          categories={categories}
          currentMonthYear={currentMonthYear}
          onComplete={async () => {
            await queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
            await queryClient.invalidateQueries({ queryKey: ['monthData'] });
            await queryClient.invalidateQueries({ queryKey: ['categories'] });
          }}
        />
      )}

      {/* Barre Latérale Fixe (260px) */}
      <Sidebar username={user?.username} onLogout={() => logoutMutation.mutate()} />

      {/* Espace de Travail Central */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Entête avec Sélecteur de Mois, Report M-1 et Import/Export CSV */}
        <MonthHeader
          netBalance={summary?.netBalance}
          onOpenImport={() => setShowBankImport(true)}
        />

        {/* Contenu Défilant selon l'onglet actif */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {monthLoading && (
            <div className="mb-4 text-xs font-mono text-cyan-600 dark:text-cyan-400 animate-pulse">
              Synchronisation des transactions du mois...
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView summary={summary} transactions={transactions} categories={categories} />
          )}

          {activeTab === 'income' && (
            <TransactionsTableView
              title="Rentrées d'argent"
              type="INCOME"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={async (data) => { await addTransactionMutation.mutateAsync(data); }}
              onUpdateTransaction={async (id, data, scope) => { await updateTransactionMutation.mutateAsync({ id, data, scope }); }}
              onToggleStatus={async (id, status, stopFutureRepetitions) => {
                await toggleStatusMutation.mutateAsync({ id, status, stopFutureRepetitions });
              }}
              onDeleteTransaction={async (id) => { await deleteTransactionMutation.mutateAsync(id); }}
            />
          )}

          {activeTab === 'recurring' && (
            <TransactionsTableView
              title="Dépenses répétitives (Charges & Abonnements)"
              type="RECURRING_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={async (data) => { await addTransactionMutation.mutateAsync(data); }}
              onUpdateTransaction={async (id, data, scope) => { await updateTransactionMutation.mutateAsync({ id, data, scope }); }}
              onToggleStatus={async (id, status, stopFutureRepetitions) => {
                await toggleStatusMutation.mutateAsync({ id, status, stopFutureRepetitions });
              }}
              onDeleteTransaction={async (id) => { await deleteTransactionMutation.mutateAsync(id); }}
            />
          )}

          {activeTab === 'current' && (
            <TransactionsTableView
              title="Dépenses courantes du quotidien"
              type="CURRENT_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={async (data) => { await addTransactionMutation.mutateAsync(data); }}
              onUpdateTransaction={async (id, data, scope) => { await updateTransactionMutation.mutateAsync({ id, data, scope }); }}
              onToggleStatus={async (id, status, stopFutureRepetitions) => {
                await toggleStatusMutation.mutateAsync({ id, status, stopFutureRepetitions });
              }}
              onDeleteTransaction={async (id) => { await deleteTransactionMutation.mutateAsync(id); }}
            />
          )}

          {activeTab === 'unforeseen' && (
            <TransactionsTableView
              title="Dépenses imprévues & Urgences"
              type="UNFORESEEN_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={async (data) => { await addTransactionMutation.mutateAsync(data); }}
              onUpdateTransaction={async (id, data, scope) => { await updateTransactionMutation.mutateAsync({ id, data, scope }); }}
              onToggleStatus={async (id, status, stopFutureRepetitions) => {
                await toggleStatusMutation.mutateAsync({ id, status, stopFutureRepetitions });
              }}
              onDeleteTransaction={async (id) => { await deleteTransactionMutation.mutateAsync(id); }}
            />
          )}

          {activeTab === 'savings' && (
            <SavingsView
              currentMonthYear={currentMonthYear}
              savingsCapacity={Math.max(0, summary?.netBalance || 0)}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['categories'] })}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView categories={categories} currentMonthYear={currentMonthYear} />
          )}
        </main>
      </div>

      {/* Modal Import Bancaire CSV (F3) */}
      <BankImportModal
        isOpen={showBankImport}
        onClose={() => setShowBankImport(false)}
        categories={categories}
        currentMonthYear={currentMonthYear}
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['monthData'] })}
      />

      {/* Conteneur Global Toasts avec Undo (U1) */}
      <ToastContainer />
    </div>
  );
}

export default App;
