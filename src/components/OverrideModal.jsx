export default function OverrideModal({ field, localValue, onLocal, onGlobal, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg w-full max-w-sm p-6 space-y-5 rack-panel">
        <div>
          <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase font-bold mb-2">APPLY CHANGE TO</p>
          <p className="font-headline text-on-surface text-sm">
            You changed <span className="text-primary font-bold">{field}</span> to{' '}
            <span className="text-primary font-mono-digital">{localValue}</span>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onLocal}
            className="w-full py-3 bg-primary text-on-primary font-headline font-bold text-xs uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
          >
            This Entry Only
          </button>
          <button
            onClick={onGlobal}
            className="w-full py-3 bg-surface-container-high text-on-surface font-headline font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all border border-outline-variant/20"
          >
            Update Song Globally
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-outline hover:text-primary text-xs font-mono-digital uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
