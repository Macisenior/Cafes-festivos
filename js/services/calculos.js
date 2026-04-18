export function calcularGastoPorPersona(personas, gastos) {
  const gastoPersona = {};

  personas.forEach(p => gastoPersona[p.id] = 0);

  gastos.forEach(g => {
    if (!g.participantes || !g.monto) return;

    const parte = g.monto / g.participantes.length;

    g.participantes.forEach(id => {
      if (!gastoPersona[id]) gastoPersona[id] = 0;
      gastoPersona[id] += parte;
    });
  });

  return gastoPersona;
}

export function calcularBalance(personas, gastos) {
  const gastoPersona = calcularGastoPorPersona(personas, gastos);

  return personas.map(p => ({
    id: p.id,
    nombre: p.nombre,
    balance: (p.aportado || 0) - (gastoPersona[p.id] || 0)
  }));
}