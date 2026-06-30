import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Obtener credenciales de las variables de entorno
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

interface EmailLogEntry {
  timestamp: string;
  email: string;
  name: string;
  status: 'success' | 'failed';
  details: string; // messageId o mensaje de error
  type: string;
}

/**
 * Registra un evento de envío de correo en un archivo JSON local (data/email-logs.json).
 */
export function writeEmailLog(
  email: string,
  name: string,
  status: 'success' | 'failed',
  details: string,
  type = 'confirm_signup'
) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const logFilePath = path.join(dataDir, 'email-logs.json');
    let logs: EmailLogEntry[] = [];
    
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, 'utf-8');
        logs = JSON.parse(fileContent);
      } catch (e) {
        console.error('Error al parsear el archivo de logs de correo, se reiniciará:', e);
      }
    }
    
    const newEntry: EmailLogEntry = {
      timestamp: new Date().toISOString(),
      email,
      name,
      status,
      details,
      type
    };
    
    logs.unshift(newEntry); // El más reciente primero
    
    // Limitar a los últimos 100 registros
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
    
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error crítico al escribir en el log de correos:', err);
  }
}

/**
 * Inicializa el transportador de Nodemailer de forma perezosa (lazy)
 */
const getTransporter = () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      'Falta configuración de correo. Configura EMAIL_USER y EMAIL_PASS en tu archivo .env.local'
    );
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
};

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envía un correo electrónico de confirmación utilizando la plantilla HTML premium y Nodemailer.
 * 
 * @param toEmail Correo electrónico del destinatario
 * @param name Nombre completo del destinatario
 * @param confirmationUrl URL de confirmación de registro
 */
export async function sendConfirmationEmail(
  toEmail: string,
  name: string,
  confirmationUrl: string
): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();

    // 1. Obtener y leer la plantilla HTML
    const templatePath = path.join(process.cwd(), 'templates', 'emails', 'confirm-signup.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontró la plantilla de correo en: ${templatePath}`);
    }
    
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // 2. Interpolar las variables dinámicas en la plantilla
    // Reemplazar la condición del nombre
    htmlContent = htmlContent.replace(
      /\{\{\s*if\s+\.Data\.nombre_completo\s*\}\}\{\{\s*\.Data\.nombre_completo\s*\}\}\{\{\s*else\s*\}\}Viajero\{\{\s*end\s*\}\}/g,
      name || 'Viajero'
    );
    
    // Reemplazar la URL de confirmación (todas las apariciones)
    htmlContent = htmlContent.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, confirmationUrl);

    // 3. Crear texto alternativo sin HTML para clientes de correo básicos
    const plainTextContent = `¡Hola ${name || 'Viajero'}!\n\n` +
      `¡Te damos la bienvenida a GIMA! Tu cuenta ha sido creada con éxito.\n\n` +
      `Por favor, confirma tu correo electrónico y activa tu cuenta haciendo clic en el siguiente enlace:\n` +
      `${confirmationUrl}\n\n` +
      `Si no has solicitado este registro, puedes ignorar este correo de forma segura.\n\n` +
      `© 2026 GIMA AI. Todos los derechos reservados.`;

    // 4. Enviar el correo electrónico
    const mailOptions = {
      from: `"GIMA AI" <${EMAIL_USER}>`,
      to: toEmail,
      subject: '¡Bienvenido a GIMA! Activa tu cuenta',
      html: htmlContent,
      text: plainTextContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de confirmación enviado con éxito. MessageId:', info.messageId);

    // Registrar en el log de correos locales
    writeEmailLog(toEmail, name, 'success', `Enviado con éxito (MessageId: ${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('Error al enviar el correo de confirmación:', error);
    
    // Registrar fallo en el log de correos locales
    writeEmailLog(toEmail, name, 'failed', error.message || 'Error desconocido al enviar');

    return {
      success: false,
      error: error.message || 'Error desconocido al enviar el correo electrónico',
    };
  }
}

/**
 * Envía un correo electrónico para restablecer la contraseña utilizando la plantilla HTML y Nodemailer.
 * 
 * @param toEmail Correo electrónico del destinatario
 * @param name Nombre completo del destinatario
 * @param resetLink Enlace único de restablecimiento de contraseña
 */
export async function sendResetPasswordEmail(
  toEmail: string,
  name: string,
  resetLink: string
): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();

    // 1. Obtener y leer la plantilla HTML
    const templatePath = path.join(process.cwd(), 'templates', 'emails', 'reset-password.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontró la plantilla de correo en: ${templatePath}`);
    }
    
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // 2. Interpolar las variables dinámicas en la plantilla
    htmlContent = htmlContent.replace(/\{\{\s*name\s*\}\}/g, name || 'Viajero');
    htmlContent = htmlContent.replace(/\{\{\s*email\s*\}\}/g, toEmail);
    htmlContent = htmlContent.replace(/\{\{\s*resetLink\s*\}\}/g, resetLink);

    // 3. Crear texto alternativo sin HTML
    const plainTextContent = `¡Hola ${name || 'Viajero'}!\n\n` +
      `Hemos recibido una solicitud para restablecer tu contraseña en GIMA para tu cuenta: ${toEmail}.\n\n` +
      `Para elegir una nueva contraseña de acceso, haz clic en el siguiente enlace:\n` +
      `${resetLink}\n\n` +
      `Este enlace único de recuperación es válido durante 24 horas. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.\n\n` +
      `© 2026 GIMA AI. Todos los derechos reservados.`;

    // 4. Enviar el correo electrónico
    const mailOptions = {
      from: `"GIMA AI" <${EMAIL_USER}>`,
      to: toEmail,
      subject: 'Restablecer tu contraseña de GIMA',
      html: htmlContent,
      text: plainTextContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de recuperación enviado con éxito. MessageId:', info.messageId);

    // Registrar en el log de correos locales
    writeEmailLog(toEmail, name, 'success', `Recuperación enviada con éxito (MessageId: ${info.messageId})`, 'password_reset');

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('Error al enviar el correo de recuperación:', error);
    
    // Registrar fallo en el log de correos locales
    writeEmailLog(toEmail, name, 'failed', error.message || 'Error desconocido al enviar', 'password_reset');

    return {
      success: false,
      error: error.message || 'Error desconocido al enviar el correo electrónico',
    };
  }
}
