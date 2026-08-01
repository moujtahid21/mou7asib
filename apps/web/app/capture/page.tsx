import CaptureForm from "./CaptureForm";

export default function CapturePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Photographier une facture</h1>
      <p className="mt-2 text-sm text-slate-600">
        Utilisez uniquement vos propres documents. L&apos;extraction prend
        généralement plusieurs minutes.
      </p>
      <CaptureForm />
    </main>
  );
}
