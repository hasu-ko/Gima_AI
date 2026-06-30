import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { sendResetPasswordEmail, writeEmailLog } from '@/lib/nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, redirectTo } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'El correo electrónico es obligatorio.' },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const isSmtpConfigured = !!(emailUser && emailPass);
    const isDbConfigured = isSupabaseConfigured();

    // =========================================================================
    // CASO A: BASE DE DATOS SUPABASE CONFIGURADA (REAL)
    // =========================================================================
    if (isDbConfigured) {
      if (!supabaseAdmin) {
        return NextResponse.json(
          { success: false, error: 'El cliente administrador de Supabase no está inicializado.' },
          { status: 500 }
        );
      }

      // 1. Obtener nombre del usuario si existe en perfiles
      const { data: profile } = await supabaseAdmin
        .from('perfiles')
        .select('nombre_completo')
        .eq('email', email)
        .maybeSingle();

      const nombre = profile?.nombre_completo || 'Viajero';

      // 2. Generar el enlace único de recuperación
      const targetRedirect = redirectTo || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?redirect_to=/reset-password`;

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: targetRedirect
        }
      });

      if (error) {
        console.error('Error al generar enlace de recuperación:', error);
        return NextResponse.json(
          { success: false, error: 'No se encontró ningún usuario con este correo electrónico.' },
          { status: 404 }
        );
      }

      const resetLink = data.properties?.action_link;
      if (!resetLink) {
        return NextResponse.json(
          { success: false, error: 'No se pudo generar el enlace único de recuperación.' },
          { status: 500 }
        );
      }

      // 3. Enviar el correo usando Nodemailer si está configurado
      if (isSmtpConfigured) {
        const emailResult = await sendResetPasswordEmail(email, nombre, resetLink);
        if (emailResult.success) {
          return NextResponse.json({
            success: true,
            isMock: false,
            message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.'
          });
        } else {
          return NextResponse.json({
            success: true,
            isMock: false,
            message: `Enlace de recuperación generado en base de datos, pero falló el envío del correo electrónico: ${emailResult.error}`
          });
        }
      } else {
        // Si no está SMTP, registramos de todas formas en los logs locales para que el dev copie el link
        writeEmailLog(
          email,
          nombre,
          'success',
          `[SIMULADO - SIN SMTP] Enlace generado: ${resetLink}`,
          'password_reset'
        );

        return NextResponse.json({
          success: true,
          isMock: false,
          message: 'Modo Desarrollo: Enlace generado con éxito. Copia el enlace desde la Consola de Logs (/email-logs).'
        });
      }
    }

    // =========================================================================
    // CASO B: MODO DESARROLLO SIN SUPABASE (SIMULADO)
    // =========================================================================
    const mockResetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=mock-reset-token-12345&email=${encodeURIComponent(email)}`;

    writeEmailLog(
      email,
      'Viajero Demo',
      'success',
      `[SIMULADO DESCONECTADO] Enlace generado: ${mockResetLink}`,
      'password_reset'
    );

    return NextResponse.json({
      success: true,
      isMock: true,
      message: 'Modo Simulado: Enlace generado con éxito. Puedes copiar el enlace desde el panel de Logs (/email-logs).'
    });

  } catch (error: any) {
    console.error('Error en /api/forgot-password:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ocurrió un error inesperado.' },
      { status: 500 }
    );
  }
}
