import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase con tus credenciales de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cedula = searchParams.get('cedula');

  if (!cedula) {
    return NextResponse.json(
      { message: 'El número de cédula es obligatorio.' },
      { status: 400 }
    );
  }

  try {
    // Consulta real en la tabla de Supabase (ajusta el nombre de tu tabla si es diferente, ej. 'trabajadores', 'certificados', o 'permisos')
    const { data, error } = await supabase
      .from('trabajadores') // <--- Cambia 'trabajadores' por el nombre exacto de tu tabla en Supabase
      .select('*')
      .eq('cedula', cedula.trim())
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: 'No se encontró un registro activo para esta cédula en el sistema.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      nombre: data.nombre || data.full_name,
      estado: data.estado || 'Aprobado',
      certificado: data.certificado || 'Certificado de Alturas Vigente'
    });

  } catch (error) {
    return NextResponse.json(
      { message: 'Error interno al consultar la base de datos.' },
      { status: 500 }
    );
  }
}