'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 print:hidden"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
