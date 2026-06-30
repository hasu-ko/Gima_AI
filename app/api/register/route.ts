import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { sendConfirmationEmail, writeEmailLog } from '@/lib/nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nombreCompleto, fechaNacimiento, redirectTo } = body;

    // 1. Validaciones básicas
    if (!email || !password || !nombreCompleto || !fechaNacimiento) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const isSmtpConfigured = !!(emailUser && emailPass);
    const isDbConfigured = isSupabaseConfigured();

    // =========================================================================
    // CASO A: BASE DE DATOS SUPABASE CONFIGURADA (PRODUCCIÓN REAL)
    // =========================================================================
    if (isDbConfigured) {
      if (!supabaseAdmin) {
        return NextResponse.json(
          { success: false, error: 'El cliente administrador de Supabase no está inicializado.' },
          { status: 500 }
        );
      }

      // 1. Generar enlace oficial de confirmación de registro en Supabase
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: {
            nombre_completo: nombreCompleto,
            fecha_nacimiento: fechaNacimiento,
          },
          redirectTo: redirectTo || 'http://localhost:3000/auth/callback',
        }
      });

      if (error) {
        console.error('Error al registrar usuario en Supabase Admin:', error);
        return NextResponse.json(
          { success: false, error: `Error de Supabase: ${error.message}` },
          { status: 400 }
        );
      }

      const confirmationUrl = data.properties?.action_link;
      
      if (!confirmationUrl) {
        return NextResponse.json(
          { success: false, error: 'No se pudo generar el enlace de confirmación.' },
          { status: 550 }
        );
      }

      // 2. Intentar enviar correo con Nodemailer si está configurado
      if (isSmtpConfigured) {
        const emailResult = await sendConfirmationEmail(email, nombreCompleto, confirmationUrl);
        
        if (emailResult.success) {
          return NextResponse.json({
            success: true,
            isMock: false,
            message: '¡Registro completado! Verifica tu correo electrónico para activar tu cuenta.',
          });
        } else {
          return NextResponse.json({
            success: true, // El usuario se creó en DB
            isMock: false,
            message: `Registro completado en base de datos, pero falló el envío del correo de confirmación: ${emailResult.error}`,
          });
        }
      } else {
        // Loggear que no está configurado SMTP pero se creó el usuario
        const msg = 'Servicio SMTP no configurado. Enlace de confirmación generado: ' + confirmationUrl;
        console.log(`[SMTP] ${msg}`);
        writeEmailLog(email, nombreCompleto, 'failed', 'Falta configuración de Nodemailer (EMAIL_USER / EMAIL_PASS). Enlace: ' + confirmationUrl);
        
        return NextResponse.json({
          success: true,
          isMock: false,
          message: 'Registro completado en base de datos. (SMTP no configurado en servidor: revisa los logs de correo para ver el enlace de activación).',
        });
      }
    } 

    // =========================================================================
    // CASO B: MODO SIMULADO / DESARROLLO (SIN CONFIGURACIÓN DE BASE DE DATOS)
    // =========================================================================
    else {
      console.log('[REGISTRO SIMULADO] Procesando registro para:', email);
      
      const mockConfirmationUrl = `http://localhost:3000/auth/callback?token_hash=mock_dev_token_${Math.random().toString(36).substring(2, 9)}&type=signup`;

      // 1. Si SMTP está configurado, enviamos un correo real de prueba con la plantilla
      if (isSmtpConfigured) {
        const emailResult = await sendConfirmationEmail(email, nombreCompleto, mockConfirmationUrl);
        
        if (emailResult.success) {
          writeEmailLog(
            email, 
            nombreCompleto, 
            'success', 
            `[Simulado] Correo de prueba real enviado a ${email} (MessageId: ${emailResult.messageId})`
          );
          return NextResponse.json({
            success: true,
            isMock: true,
            message: '¡Registro simulado exitoso! Se ha enviado un correo de prueba real a tu bandeja de entrada.',
          });
        } else {
          return NextResponse.json({
            success: true,
            isMock: true,
            message: `Registro simulado exitoso, pero falló el envío del correo de prueba: ${emailResult.error}`,
          });
        }
      } 
      
      // 2. Si no hay SMTP ni base de datos, simulación pura local
      else {
        writeEmailLog(
          email, 
          nombreCompleto, 
          'success', 
          `[Simulado] Cuenta simulada registrada con éxito. (Nodemailer y Supabase sin configurar)`
        );
        return NextResponse.json({
          success: true,
          isMock: true,
          message: '¡Usuario registrado con éxito (Modo Simulado)! Redirigiendo...',
        });
      }
    }
  } catch (error: any) {
    console.error('Error en Route Handler de Registro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno al procesar el registro.' },
      { status: 500 }
    );
  }
}
