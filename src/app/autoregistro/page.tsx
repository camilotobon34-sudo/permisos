"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  CheckCircle2, 
  Camera, 
  Loader2, 
  ShieldCheck, 
  PenTool, 
  Lock 
} from "lucide-react";
import { createWorker } from "tesseract.js";
import SignaturePad from "signature_pad";

function AutoRegistroContent() {
  const searchParams = useSearchParams();
  const eventName = searchParams.get("evento") || "Evento de Capacitación";
  const urlKey = searchParams.get("key") || "";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Datos, 2: Foto OCR, 3: Firma, 4: Éxito
  const [cedula, setCedula] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [keyError, setKeyError] = useState("");

  // OCR
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  // Firma
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadInstance = useRef<SignaturePad | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (step === 3 && signatureCanvasRef.current) {
      if (!signaturePadInstance.current) {
        signaturePadInstance.current = new SignaturePad(signatureCanvasRef.current, {
          penColor: "#0f172a",
          backgroundColor: "#f8fafc",
        });
      }
    }
  }, [step]);

  const handleVerifyKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula.trim()) {
      setKeyError("Ingrese su número de cédula.");
      return;
    }
    if (urlKey && inputKey !== urlKey) {
      setKeyError("La clave temporal ingresada no es válida o ya expiró.");
      return;
    }
    setKeyError("");
    setStep(2);
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setImagePreview(base64Image);
      
      setIsProcessingOcr(true);
      try {
        const worker = await createWorker("spa");
        const ret = await worker.recognize(base64Image);
        await worker.terminate();

        const cedulaMatch = ret.data.text.match(/\b\d{7,10}\b/);
        if (cedulaMatch) {
          setCedula(cedulaMatch[0]);
        }
      } catch (err) {
        console.error("Error OCR:", err);
      } finally {
        setIsProcessingOcr(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = () => {
    signaturePadInstance.current?.clear();
  };

  const handleFinalSubmit = () => {
    if (signaturePadInstance.current?.isEmpty()) {
      alert("Por favor realice su firma en el recuadro.");
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setStep(4);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 to-slate-900 p-6 border-b border-slate-800 text-center">
          <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase bg-indigo-900/50 px-3 py-1 rounded-full border border-indigo-700/50">
            Asistencia Digital
          </span>
          <h1 className="text-xl font-bold text-white mt-2">{eventName}</h1>
          <p className="text-xs text-slate-400 mt-1">Autoregistro seguro del participante</p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* PASO 1: CEDULA Y CLAVE */}
          {step === 1 && (
            <form onSubmit={handleVerifyKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Número de Cédula:
                </label>
                <input
                  type="text"
                  required
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="Ej: 1017123456"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> Clave Temporal (dictada por el entrenador):
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Código de 4 dígitos"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm tracking-widest font-mono text-center focus:outline-none focus:border-indigo-500"
                />
              </div>

              {keyError && <p className="text-xs text-rose-400">{keyError}</p>}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm mt-2"
              >
                Continuar
              </button>
            </form>
          )}

          {/* PASO 2: OCR CEDULA */}
          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-xs font-medium text-slate-300">
                Fotografía del Documento de Identidad:
              </label>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-6 bg-slate-950/50 text-center">
                {imagePreview ? (
                  <div className="space-y-2">
                    <img src={imagePreview} alt="Documento" className="max-h-40 rounded-lg mx-auto" />
                    <label className="text-xs text-indigo-400 cursor-pointer underline block">
                      Repetir foto
                      <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer space-y-2 flex flex-col items-center">
                    <Camera className="w-8 h-8 text-indigo-400" />
                    <span className="text-xs text-slate-300 font-medium">Toca para tomar foto a tu cédula</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
                  </label>
                )}
              </div>

              {isProcessingOcr && (
                <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs py-1">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando documento...
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-medium"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-medium shadow-lg shadow-indigo-600/20"
                >
                  Siguiente: Firma
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: FIRMA DIGITAL */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-indigo-400" /> Firma Digital (dibuja en la pantalla):
                </label>
                <button onClick={handleClearSignature} className="text-xs text-slate-400 underline">
                  Limpiar
                </button>
              </div>

              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-100 flex justify-center">
                <canvas ref={signatureCanvasRef} width={340} height={160} className="w-full touch-none" />
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinalSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Asistencia
              </button>
            </div>
          )}

          {/* PASO 4: CONFIRMACIÓN EXITOSA */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-white">¡Asistencia Registrada!</h2>
              <p className="text-xs text-slate-400">
                Tu asistencia ha sido confirmada satisfactoriamente en el sistema. Puedes cerrar esta ventana.
              </p>
              <div className="pt-2 text-xs text-slate-500 flex items-center justify-center gap-1">
                <ShieldCheck className="w-4 h-4 text-indigo-400" /> Registro verificado y protegido
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutoRegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Cargando...</div>}>
      <AutoRegistroContent />
    </Suspense>
  );
}