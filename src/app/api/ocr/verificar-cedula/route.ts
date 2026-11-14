import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
    const supabase = createSupabaseServerClient();
    // Consulta conectada a tu tabla 'alumnos' en Supabase
    const { data, error } = await supabase
      .from('alumnos') 
      .select('*')
      .eq('cedula', cedula.trim()) // Asegúrate de que la columna en tu tabla se llame 'cedula' o 'documento'
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: 'No se encontró un registro para esta cédula en el sistema.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      nombre: data.nombre || data.full_name || data.nombres,
      estado: 'Aprobado',
      certificado: 'Certificado Vigente'
    });

  } catch (error) {
    console.error('Error al consultar Supabase para verificar cédula:', error);
    return NextResponse.json(
      { message: 'Error interno al consultar la base de datos.' },
      { status: 500 }
    );
  }
}