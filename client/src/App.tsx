import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MonthHeader } from './components/MonthHeader';
import { DashboardView } from './components/DashboardView';
import { TransactionsTableView } from './components/TransactionsTableView';
import { CategoriesView } from './components/CategoriesView';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthModal } from './components/AuthModal';
import { useUIStore } from './store/useUIStore';
import { MonthlySummary, Transaction, Category } from './types';

export function App() {
  const { currentMonthYear, activeTab, autoCarryOverBalance, theme } = useUIStore();

  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasExistingUser, setHasExistingUser] = useState(false);

  // Synchronisation du thème sur l'élément body
  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const [summary, setSummary] = useState<MonthlySummary | undefined>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Vérification de la session et du statut initial
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const statusRes = await fetch('/api/auth/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setHasExistingUser(statusData.hasUser);
        }

        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData.user);
        }
      } catch (err) {
        console.error('Erreur auth check:', err);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  // 2. Chargement des catégories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Erreur chargement catégories:', err);
    }
  }, []);

  // 3. Chargement des données du mois (Moteur Rollover synchrone)
  const fetchMonthData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const url = `/api/months/${currentMonthYear}?carryOverBalance=${autoCarryOverBalance}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Erreur fetch month data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonthYear, autoCarryOverBalance]);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchMonthData();
    }
  }, [user, currentMonthYear, autoCarryOverBalance, fetchCategories, fetchMonthData]);

  // Actions Transactions
  const handleAddTransaction = async (data: Partial<Transaction>) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const createdTx = await res.json();
      if (createdTx.month_year && createdTx.month_year !== currentMonthYear) {
        useUIStore.getState().setCurrentMonthYear(createdTx.month_year);
      } else {
        await fetchMonthData();
      }
    }
  };

  const handleToggleStatus = async (
    id: string,
    newStatus: 'ACTIVE' | 'PENDING',
    stopFutureRepetitions = false
  ) => {
    const res = await fetch(`/api/transactions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus, stopFutureRepetitions }),
    });
    if (res.ok) {
      await fetchMonthData();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      await fetchMonthData();
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm font-mono">
        Chargement de l'environnement sécurisé...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Modal Authentification WebAuthn Passkeys */}
      {!user && (
        <AuthModal
          hasExistingUser={hasExistingUser}
          onSuccess={(loggedInUser) => setUser(loggedInUser)}
        />
      )}

      {/* Barre Latérale Fixe (260px) */}
      <Sidebar username={user?.username} onLogout={handleLogout} />

      {/* Espace de Travail Central */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Entête avec Sélecteur de Mois et Report M-1 */}
        <MonthHeader netBalance={summary?.netBalance} />

        {/* Contenu Défilant selon l'onglet actif */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {loading && (
            <div className="mb-4 text-xs font-mono text-indigo-400 animate-pulse">
              Synchronisation des transactions du mois...
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView summary={summary} transactions={transactions} />
          )}

          {activeTab === 'income' && (
            <TransactionsTableView
              title="Rentrées d'argent"
              type="INCOME"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={handleAddTransaction}
              onToggleStatus={handleToggleStatus}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'recurring' && (
            <TransactionsTableView
              title="Dépenses répétitives (Charges & Abonnements)"
              type="RECURRING_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={handleAddTransaction}
              onToggleStatus={handleToggleStatus}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'current' && (
            <TransactionsTableView
              title="Dépenses courantes du quotidien"
              type="CURRENT_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={handleAddTransaction}
              onToggleStatus={handleToggleStatus}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'unforeseen' && (
            <TransactionsTableView
              title="Dépenses imprévues & Urgences"
              type="UNFORESEEN_EXPENSE"
              transactions={transactions}
              categories={categories}
              currentMonthYear={currentMonthYear}
              onAddTransaction={handleAddTransaction}
              onToggleStatus={handleToggleStatus}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView categories={categories} onRefresh={fetchCategories} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView categories={categories} currentMonthYear={currentMonthYear} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
