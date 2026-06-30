import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const logFilePath = path.join(process.cwd(), 'data', 'email-logs.json');
    
    if (!fs.existsSync(logFilePath)) {
      return NextResponse.json({ logs: [] });
    }
    
    const fileContent = fs.readFileSync(logFilePath, 'utf-8');
    const logs = JSON.parse(fileContent);
    
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error al obtener los logs de correo:', error);
    return NextResponse.json(
      { error: 'No se pudieron leer los logs de correo.' },
      { status: 500 }
    );
  }
}
