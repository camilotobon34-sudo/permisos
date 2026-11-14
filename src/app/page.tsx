'use client'

export default function RegistroPage() {
  return (
    <main style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#020617',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        backgroundColor: '#450a0a',
        border: '2px solid #dc2626',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          ⛔
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '900',
          color: '#f87171',
          marginBottom: '12px',
          letterSpacing: '1px'
        }}>
          SISTEMA SUSPENDIDO
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#cbd5e1',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>
          El servicio de control de asistencias ha sido deshabilitado temporalmente por disposición de la administración. No hay acceso a registros.
        </p>
        <div style={{
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: 'monospace',
          borderTop: '1px solid #7f1d1d',
          paddingTop: '12px'
        }}>
          ESTADO: ACCESO_RESTRINGIDO_ADMIN
        </div>
      </div>
    </main>
  )
}