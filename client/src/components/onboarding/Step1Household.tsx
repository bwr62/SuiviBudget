import React from 'react';

interface Step1Props {
  adultsCount: number;
  setAdultsCount: (val: number) => void;
  childrenCount: number;
  setChildrenCount: (val: number) => void;
  hasPets: boolean;
  setHasPets: (val: boolean) => void;
  paydayDefault: number;
  setPaydayDefault: (val: number) => void;
  setMobilePlansCount: (val: number) => void;
}

export const Step1Household: React.FC<Step1Props> = ({
  adultsCount,
  setAdultsCount,
  childrenCount,
  setChildrenCount,
  hasPets,
  setHasPets,
  paydayDefault,
  setPaydayDefault,
  setMobilePlansCount,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Composition de votre foyer</h2>
        <p className="text-xs text-slate-400 mt-1">
          Ces informations personnalisent automatiquement les étapes suivantes (salaires, cantine, allocations, animaux).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Adultes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">Nombre d'adultes</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, adultsCount - 1);
                setAdultsCount(next);
                setMobilePlansCount(next);
              }}
              className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
            >
              -
            </button>
            <span className="font-mono text-lg font-bold text-indigo-400 w-8 text-center">
              {adultsCount}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = adultsCount + 1;
                setAdultsCount(next);
                setMobilePlansCount(next);
              }}
              className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Générera automatiquement les lignes de salaires associées.</p>
        </div>

        {/* Enfants */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">Nombre d'enfants à charge</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
              className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
            >
              -
            </button>
            <span className="font-mono text-lg font-bold text-indigo-400 w-8 text-center">
              {childrenCount}
            </span>
            <button
              type="button"
              onClick={() => setChildrenCount(childrenCount + 1)}
              className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-base"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Active les suggestions pour cantine, garde, et allocations familiales.</p>
        </div>

        {/* Animaux de compagnie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">Animaux de compagnie</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHasPets(false)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                !hasPets
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Non
            </button>
            <button
              type="button"
              onClick={() => setHasPets(true)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                hasPets
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Oui (Chiens, chats...)
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Proposera les rubriques alimentation animale et mutuelle santé.</p>
        </div>

        {/* Jour habituel de réception des revenus */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">
            Jour habituel de paie / revenus principaux
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Le</span>
            <input
              type="number"
              min={1}
              max={31}
              value={paydayDefault}
              onChange={(e) => setPaydayDefault(parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold text-indigo-400 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400">du mois (ex: 28, 30 ou 1er)</span>
          </div>
          <p className="text-[11px] text-slate-500">Date affectée par défaut à vos entrées d'argent récurrentes.</p>
        </div>
      </div>
    </div>
  );
};
