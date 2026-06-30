import { NextRequest, NextResponse } from 'next/server';
import { consumirCredito } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    const { userId, message } = await request.json();

    if (!userId || !message) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos (userId, message).' },
        { status: 400 }
      );
    }

    // 1. Validar y descontar un crédito en el backend
    const creditResult = await consumirCredito(userId);

    if (!creditResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Créditos agotados. Compra más créditos para continuar.',
          creditsRemaining: 0 
        },
        { status: 402 } // 402 es Payment Required, ideal para muros de pago
      );
    }

    // 2. Generar respuesta simulada adaptada a la temática de Lore/Meta de GIMA
    const query = message.toLowerCase();
    let reply = '';

    if (query.includes('jiyan') || query.includes('waves')) {
      reply = `[LORE & META DE WUTHERING WAVES - ANALISIS DE JIYAN]

=== RECOMENDACIONES DE META (Build de Jiyan) ===
• Set de Ecos recomendado: 5 piezas de "Sierra Gale" (Daño Aero). El eco principal ideal es "Feilian Beringal" (brinda Bono de Daño Aero y aumenta el daño de ataques pesados).
• Estadísticas principales: Crit Rate / Crit DMG en Ecos de costo 4, Daño Aero en Ecos de costo 3, y ATQ% en Ecos de costo 1.
• Armas sugeridas: "Verdant Summit" (5★ - Su firma), "Helios Cleaver" (4★ - Opción F2P sólida).
• Composición ideal: Jiyan (DPS Principal) + Mortefi (Sub-DPS, aumenta daño de ataque pesado) + Verina (Soporte / Sanadora).

=== EXTRACTO DE LORE ===
Jiyan es el general del Exilio Nocturno (Midnight Rangers) en Jinzhou. Ha dedicado su vida a defender la frontera contra las amenazas del Tacet Discords. Su resonancia manipula el viento en forma de un dragón esmeralda, simbolizando su liderazgo indomable.`;
    } 
    else if (query.includes('acheron') || query.includes('star rail') || query.includes('hsr')) {
      reply = `[META & LORE DE HONKAI STAR RAIL - ANALISIS DE ACHERON]

=== RECOMENDACIONES DE META (Build de Acheron) ===
• Set de Reliquias: 4 piezas de "Pioneer Diver of Dead Waters" (aumenta daño contra enemigos con estados alterados).
• Ornamentos: 2 piezas de "Izumo Gensei and Takama Divine Realm" (otorga ATQ% y Tasa Crítica si hay otro personaje del camino de la Nulidad en el equipo).
• Equipamiento de Cono: "Along the Passing Shore" (5★ - Firma), "Good Night and Sleep Well" (4★ - Excelente F2P).
• Equipo Meta: Acheron + Pela + Silver Wolf (o Jiaoqiu) + Aventurina (Soporte de sustentación).

=== EXTRACTO DE LORE ===
Acheron es una Auto-Emanadora del IX (la Nulidad) que se hace pasar por una Guardabosques de la Galaxia. Su espada, "Naught", carga con la tragedia de su planeta natal destruido, Izumo. Su existencia está desvaneciéndose lentamente debido al efecto de la Nulidad.`;
    }
    else if (query.includes('raiden') || query.includes('genshin') || query.includes('shogun')) {
      reply = `[LORE PROFUNDO - RAIDEN SHOGUN / EI]

=== ANALISIS DE LORE (Genshin Impact) ===
La Raiden Shogun es en realidad dos entidades: la marioneta (Shogun) creada para seguir un protocolo inmutable de "Eternidad", y Raiden Ei, la verdadera Arconte Electro, quien se recluyó en el Plano de la Eutimia para evitar el desgaste del alma (Erosión).
Ei asumió el control de Inazuma tras la muerte de su hermana gemela Raiden Makoto durante el Cataclismo de Khaenri'ah hace 500 años. 

=== RECOMENDACIONES DE META (Build Actual) ===
• Set de Artefactos: 4 piezas de "Emblema del Destino de las Cortadas" (aumenta daño de definitiva según recarga de energía).
• Armas: "Luz del Segador" (5★ - Firma), "La Captura" (4★ - Excelente opción de pesca F2P).
• Equipo Popular: "Raiden National" (Raiden + Xingqiu + Xiangling + Bennett).`;
    } 
    else if (query.includes('reddit') || query.includes('foros') || query.includes('parche')) {
      reply = `[REPORTE METADATA EN TIEMPO REAL - SIMULACION DE PERPLEXITY]

Rastreando tendencias recientes en r/Genshin_Impact, r/WutheringWaves y Prydwen.gg...
• Reddit discute la viabilidad del nuevo set de artefactos introducido en la última versión. La opinión generalizada es que es un incremento del 4% de daño, no indispensable para cuentas F2P.
• Foros competitivos de Wuthering Waves reportan un aumento del uso de composiciones híbridas debido al aumento de resistencia elemental en los últimos pisos del abismo.
• Hay discusiones intensas sobre el balance del próximo personaje filtrado, debatiendo si reemplazará a los soportes de primer nivel actuales.`;
    }
    else {
      reply = `[GIMA ASSISTANT - CONSULTA GENERAL]

¡Hola! He recibido tu consulta: "${message}".

Esta respuesta simula la consolidación de Lore en Supabase y el Meta online de Perplexity. Como estás en desarrollo local (Modo Desconectado), hemos consumido 1 crédito de tu perfil.

Cuando configures tus credenciales reales:
1. Esta consulta se convertirá en un vector de búsqueda para recuperar el Lore de tu Postgres local.
2. Invocaremos la API de Perplexity para buscar las últimas guías en la web.
3. El Vercel AI SDK mezclará la información y te la entregará mediante streaming interactivo en tiempo real.

Créditos restantes en tu sesión: ${creditResult.creditosRestantes}.`;
    }

    // 3. Responder con éxito y los créditos restantes
    return NextResponse.json({
      success: true,
      response: reply,
      creditsRemaining: creditResult.creditosRestantes,
      isMock: creditResult.isMock
    });

  } catch (error: any) {
    console.error('Error en API Chat:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
