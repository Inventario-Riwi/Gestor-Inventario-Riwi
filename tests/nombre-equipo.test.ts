/**
 * Cómo se llama un equipo en pantalla (`src/lib/nombre-equipo.ts`).
 *
 * Escrito desde la decisión del usuario: en los periféricos se tiene que ver
 * «un nombre más identificable que el serial, el nombre del periférico o el
 * modelo». Por los dos lados: los periféricos cambian, los computadores no.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { identificador, nombreVisible } from '../src/lib/nombre-equipo.js';

describe('nombre visible de un equipo', () => {
  it('un periférico se llama por qué es + marca + modelo, no por su serial', () => {
    const mouse = {
      categoria: 'Mouse' as const,
      etiqueta: null,
      serial: '2238LZ0ABCD',
      marca: 'Logitech',
      modelo: 'M170',
    };
    assert.equal(nombreVisible(mouse), 'Mouse Logitech M170');
    assert.equal(identificador(mouse), '2238LZ0ABCD', 'el serial queda como dato secundario');
  });

  it('un periférico sin marca ni modelo se llama al menos por lo que es', () => {
    assert.equal(nombreVisible({ categoria: 'Teclado', etiqueta: null }), 'Teclado');
  });

  it('un monitor con etiqueta también se llama por lo que es, y la etiqueta lo identifica', () => {
    const m = { categoria: 'Monitor' as const, etiqueta: '0312', marca: 'Dell', modelo: 'P2422H' };
    assert.equal(nombreVisible(m), 'Monitor Dell P2422H');
    assert.equal(identificador(m), '0312');
  });

  it('«Otro» usa el nombre escrito, porque la categoría no dice qué es', () => {
    assert.equal(
      nombreVisible({ categoria: 'Otro', nombre_equipo: 'Base refrigerante', marca: 'Havit' }),
      'Base refrigerante',
    );
  });

  it('un portátil sigue llamándose como antes: su nombre, si no su etiqueta (el otro lado)', () => {
    assert.equal(
      nombreVisible({ categoria: 'Portátil', nombre_equipo: 'RIWI-0301', etiqueta: '0301', marca: 'Dell' }),
      'RIWI-0301',
    );
    assert.equal(
      nombreVisible({ categoria: 'Portátil', etiqueta: '0301', marca: 'Dell', modelo: 'Latitude' }),
      '0301',
    );
    assert.equal(nombreVisible({ categoria: 'Desktop', marca: 'Compumax' }), 'Compumax');
  });
});
