// Genera el manual de uso y operación de RiwiStock en PDF (pdfkit del proyecto).
//
//   RIWISTOCK_URL="https://<ip-de-la-vm>" node docs/manual/generar-manual.cjs
//
// La dirección real del servidor NO está en el repositorio: se pasa al generar.
// El PDF resultante sí la lleva, así que es de uso interno: sale en la raíz del
// proyecto como RiwiStock-Manual.pdf, que está fuera de Git (.git/info/exclude).
const path = require('path');
const fs = require('fs');
const PROYECTO = path.resolve(__dirname, '..', '..');
const PDFDocument = require('pdfkit');

const DIRECCION = process.env.RIWISTOCK_URL || 'https://<dirección de la VM>';
const SALIDA = path.join(PROYECTO, 'RiwiStock-Manual.pdf');

const C = {
  marca: '#5B4FE0',
  tinta: '#1D1C4A',
  suave: '#6E6E8B',
  linea: '#E3E2EE',
  fondo: '#F4F3FB',
  aviso: '#FFF6DD',
  avisoBorde: '#E8B931',
};

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 72, bottom: 64, left: 60, right: 60 },
  bufferPages: true,
  info: {
    Title: 'RiwiStock — Manual de uso y operación',
    Author: 'Kevin Cardona · Analista de TI',
    Subject: 'Inventario de TI',
  },
});
doc.pipe(fs.createWriteStream(SALIDA));

const ANCHO = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const X0 = doc.page.margins.left;

function espacio(alto) {
  if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function h1(texto) {
  espacio(70);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(C.marca).text(texto, X0);
  const y = doc.y + 3;
  doc.moveTo(X0, y).lineTo(X0 + ANCHO, y).lineWidth(1.2).strokeColor(C.marca).stroke();
  doc.moveDown(0.7);
}

function h2(texto) {
  espacio(50);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.tinta).text(texto, X0);
  doc.moveDown(0.25);
}

function p(texto, opciones = {}) {
  doc.font('Helvetica').fontSize(10).fillColor(C.tinta).text(texto, X0, doc.y, {
    width: ANCHO,
    lineGap: 2,
    ...opciones,
  });
  doc.moveDown(0.45);
}

function lista(items) {
  for (const it of items) {
    espacio(24);
    const y = doc.y;
    doc.circle(X0 + 4, y + 5.5, 1.8).fillColor(C.marca).fill();
    const [titulo, resto] = Array.isArray(it) ? it : [null, it];
    doc.fillColor(C.tinta).fontSize(10);
    if (titulo) {
      doc.font('Helvetica-Bold').text(titulo + ' ', X0 + 14, y, { width: ANCHO - 14, continued: true, lineGap: 2 });
      doc.font('Helvetica').text(resto, { lineGap: 2 });
    } else {
      doc.font('Helvetica').text(resto, X0 + 14, y, { width: ANCHO - 14, lineGap: 2 });
    }
    doc.moveDown(0.25);
  }
  doc.moveDown(0.3);
}

function tabla(filas, anchos = [0.32, 0.68]) {
  const cols = anchos.map((a) => a * ANCHO);
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const cabecera = i === 0;
    doc.font(cabecera ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
    const alturas = fila.map((t, j) => doc.heightOfString(t, { width: cols[j] - 12 }));
    const alto = Math.max(...alturas) + 10;
    espacio(alto);
    const y = doc.y;
    doc.rect(X0, y, ANCHO, alto).fillColor(cabecera ? C.marca : i % 2 ? '#FFFFFF' : C.fondo).fill();
    let x = X0;
    fila.forEach((t, j) => {
      doc
        .fillColor(cabecera ? '#FFFFFF' : C.tinta)
        .font(cabecera || j === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .text(t, x + 6, y + 5, { width: cols[j] - 12, lineGap: 1 });
      x += cols[j];
    });
    doc.y = y + alto;
  }
  doc.moveDown(0.8);
}

function codigo(texto) {
  doc.font('Courier').fontSize(8.6);
  const alto = doc.heightOfString(texto, { width: ANCHO - 20 }) + 14;
  espacio(alto + 6);
  const y = doc.y;
  doc.roundedRect(X0, y, ANCHO, alto, 4).fillColor('#1D1C4A').fill();
  doc.fillColor('#FFFFFF').text(texto, X0 + 10, y + 7, { width: ANCHO - 20 });
  doc.y = y + alto;
  doc.moveDown(0.7);
}

function nota(texto) {
  doc.font('Helvetica').fontSize(9.5);
  const alto = doc.heightOfString(texto, { width: ANCHO - 24, lineGap: 2 }) + 16;
  espacio(alto + 6);
  const y = doc.y;
  doc.rect(X0, y, ANCHO, alto).fillColor(C.aviso).fill();
  doc.rect(X0, y, 3, alto).fillColor(C.avisoBorde).fill();
  doc.fillColor(C.tinta).text(texto, X0 + 14, y + 8, { width: ANCHO - 24, lineGap: 2 });
  doc.y = y + alto;
  doc.moveDown(0.7);
}

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------
doc.rect(0, 0, doc.page.width, 300).fillColor(C.marca).fill();
doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(40).text('RiwiStock', X0, 120);
doc.font('Helvetica').fontSize(16).text('Manual de uso y operación', X0, 172);
doc.fontSize(11).fillColor('#DCD9FA').text('Inventario y actas de TI', X0, 198);

doc.fillColor(C.tinta).font('Helvetica-Bold').fontSize(12).text('Para', X0, 350);
doc.font('Helvetica').fontSize(11).text('Equipo de TI · RIWI · Blackbird Labs · Emerald Fire', X0, 368);
doc.font('Helvetica-Bold').fontSize(12).text('Elaborado por', X0, 404);
doc.font('Helvetica').fontSize(11).text('Kevin Cardona · Analista de TI', X0, 422);
doc.font('Helvetica-Bold').fontSize(12).text('Versión', X0, 458);
doc.font('Helvetica').fontSize(11).text('Noviembre de 2026', X0, 476);

doc.rect(X0, 560, ANCHO, 64).fillColor(C.fondo).fill();
doc.fillColor(C.tinta).font('Helvetica-Bold').fontSize(10).text('Documento de uso interno', X0 + 14, 572);
doc.font('Helvetica').fontSize(9.5).fillColor(C.suave).text(
  'Contiene datos de la infraestructura interna (dirección del servidor y redes). No compartir fuera de la organización.',
  X0 + 14, 588, { width: ANCHO - 28 },
);

// ---------------------------------------------------------------------------
// 1. Qué es
// ---------------------------------------------------------------------------
doc.addPage();
h1('1. Qué es RiwiStock');
p('RiwiStock es la plataforma donde el equipo de TI lleva el inventario de equipos de las tres empresas: qué hay, dónde está, quién lo tiene y qué le ha pasado. Reemplaza los archivos de Excel: cada entrega, devolución, traslado o baja queda registrada en el historial del equipo, con quién la hizo y cuándo.');
p('Lo que se gestiona desde la plataforma:');
lista([
  ['Equipos:', 'portátiles, equipos de mesa, celulares y tablets.'],
  ['Periféricos:', 'monitores, teclados, mouse, diademas y otros.'],
  ['Colaboradores:', 'quién tiene qué equipo, incluidas las personas que trabajan en remoto.'],
  ['Sedes y salas de entrenamiento:', 'dónde está físicamente cada equipo.'],
  ['Actas de entrega y devolución:', 'en PDF, con número consecutivo por empresa.'],
  ['Mantenimiento:', 'partes de taller, desde que el equipo sale hasta que vuelve.'],
]);

// ---------------------------------------------------------------------------
// 2. Acceso
// ---------------------------------------------------------------------------
h1('2. Acceso');
tabla([
  ['Dato', 'Valor'],
  ['Dirección', DIRECCION],
  ['Desde dónde', 'Solo desde la red corporativa. Fuera de estas redes la plataforma no responde.'],
  ['VLAN 12', 'Medellín'],
  ['VLAN 20', 'Barranquilla'],
  ['VLAN 40', 'Habilitada según la regla del firewall corporativo.'],
  ['Navegador', 'Chrome o Edge actualizados, en computador. No está pensada para celular.'],
]);
h2('Cuentas y roles');
p('Cada persona tiene su propia cuenta con su correo corporativo. Las cuentas las crea el administrador; la contraseña inicial se comparte por el gestor de contraseñas corporativo, nunca por chat ni correo.');
tabla([
  ['Rol', 'Qué puede hacer'],
  ['Técnico', 'Registrar, editar, asignar, devolver, trasladar y prestar equipos; colaboradores; mantenimiento; actas.'],
  ['Administrador', 'Todo lo del técnico, más: crear sedes, ver claves cifradas (BIOS y licencia), cerrar motivos de revisión en bloque.'],
]);
lista([
  ['Primer ingreso:', 'la plataforma pide cambiar la contraseña temporal por una propia de al menos 12 caracteres. Hasta entonces no deja hacer nada más.'],
  ['Certificado:', 'si el navegador muestra una advertencia de seguridad al entrar, es porque el certificado interno del servidor todavía no está instalado en ese equipo.'],
]);

// ---------------------------------------------------------------------------
// 3. Módulos
// ---------------------------------------------------------------------------
h1('3. Las pantallas');
tabla([
  ['Pantalla', 'Para qué sirve'],
  ['Vista General', 'Resumen con gráficas: equipos por estado, disponibles, en mantenimiento y en tránsito.'],
  ['Inventario de Equipos', 'La tabla de todos los equipos, con buscador y filtros. Desde aquí se registra un equipo nuevo y se abre su ficha.'],
  ['Colaboradores', 'Las personas, sus equipos asignados y su sede. Incluye Onboarding y Offboarding.'],
  ['Sedes', 'Equipos y personas por sede, y los traslados en curso (se confirma aquí la llegada).'],
  ['Mantenimiento', 'Abrir y cerrar partes de taller. Abrir un parte manda el equipo a mantenimiento; cerrarlo lo devuelve.'],
  ['Generador de Actas', 'Actas de entrega y devolución en PDF, firmables.'],
]);
h2('Pestañas de Inventario');
lista([
  ['Todos:', 'el inventario completo con sus filtros.'],
  ['Bandeja de revisión:', 'equipos que llegaron del Excel con algún dato dudoso, agrupados por motivo. Se resuelven uno a uno o en bloque.'],
  ['Empresas y sedes:', 'tarjetas por empresa y sede (RIWI Medellín, RIWI Barranquilla, Blackbird Labs, Emerald Fire, Armenia, San Andrés, Cartagena, Remoto). Al abrir una, la tabla queda filtrada por ella.'],
  ['Salas de entrenamiento:', 'una tarjeta por sala y, dentro, cada puesto con su computador, pantalla, teclado y mouse, y si está completo.'],
]);

// ---------------------------------------------------------------------------
// 4. Procedimientos
// ---------------------------------------------------------------------------
h1('4. Procedimientos frecuentes');

h2('Registrar un equipo');
p('Inventario → Nuevo equipo. Primero se elige qué es, y el formulario muestra solo sus campos:');
tabla([
  ['Tipo', 'Campos propios'],
  ['Portátil', 'Nombre, marca, modelo, procesador, RAM, disco, pantalla, sistema operativo y licencia.'],
  ['Equipo de mesa', 'Lo del portátil, más "Viene con": monitor, teclado y mouse (cada uno queda como equipo propio, ligado al computador). Puede ir en una sala de entrenamiento.'],
  ['Celular / Tablet', 'Marca, modelo, IMEI (15 dígitos) y almacenamiento.'],
  ['Periférico', 'Qué es (monitor, teclado, mouse, diadema u otro), marca y modelo.'],
]);
lista([
  ['Siempre:', 'etiqueta o serial (al menos uno), empresa, sede, responsable (opcional), costo y notas.'],
  ['N/A:', 'un serial o una etiqueta "N/A", "No tiene" o "Sin etiqueta" se guarda como vacío, y se puede repetir. No cuenta para identificar el equipo.'],
  ['Mouse sin serial:', 'en un equipo de mesa, la casilla "Lo trae, pero sin serial" registra el mouse sin crear un equipo aparte.'],
]);

h2('Operaciones sobre un equipo');
p('Se hacen desde la ficha del equipo (clic en la fila). Cada una queda en el historial y pide confirmación antes de ejecutarse.');
tabla([
  ['Operación', 'Qué hace'],
  ['Asignar', 'Lo pone a nombre de una persona.'],
  ['Devolver', 'Deja de estar a nombre de su responsable y queda disponible.'],
  ['Reasignar', 'Pasa de una persona a otra (devolución + asignación).'],
  ['Reservar / Liberar', 'Lo aparta para alguien sin entregarlo todavía, o lo suelta.'],
  ['Trasladar', 'Abre un traslado a otra sede; la sede cambia cuando se confirma la llegada en Sedes.'],
  ['Prestar / Recuperar', 'Préstamo a otra empresa y su regreso.'],
  ['Dar de baja', 'Lo saca de circulación conservando su historial.'],
  ['Recuperar de baja', 'Si la baja fue un error, el equipo vuelve a circulación.'],
]);
nota('Estado, responsable y sede no se editan a mano en "Editar datos": se cambian con estas operaciones, para que el historial diga siempre quién tuvo cada equipo y cuándo.');

h2('Colaboradores en remoto');
lista([
  ['Residencia:', 'al poner la sede "Remoto" en la ficha del colaborador, se piden país, departamento, ciudad y dirección.'],
  ['Al asignar:', 'el equipo pasa a la sede Remoto y su ficha muestra la dirección de la persona. Si se muda y se actualiza su ficha, el equipo la sigue.'],
  ['Al devolver:', 'se pregunta a qué sede regresa; el equipo queda en tránsito hasta que esa sede confirme la llegada.'],
  ['Cambio de sede:', 'si una persona cambia de sede, sus equipos asignados van con ella.'],
]);

h2('Uso exclusivo: Préstamo interno y Eventos');
p('Marca equipos del pool que no se asignan a personas. Se pone al editar el equipo, en "Uso exclusivo".');
lista([
  ['Préstamo interno:', 'se puede prestar entre empresas; no se asigna ni se reserva a una persona.'],
  ['Eventos:', 'no se asigna, ni se reserva, ni se presta.'],
  ['Los dos:', 'se pueden trasladar, mandar a mantenimiento y dar de baja. Se ven con un distintivo en la tabla y tienen filtro propio.'],
]);

h2('Actas');
p('Generador de Actas: se elige la persona, el tipo (entrega o devolución) y los equipos. En modo "ejecutar", el acta hace la operación y la firma a la vez; en modo "firmar", documenta una operación ya registrada. El PDF sale con el consecutivo de la empresa.');

h2('Confirmaciones');
p('Todas las acciones que cambian algo importante piden confirmación, en rojo cuando no se pueden deshacer. Si se cierra un formulario con cambios sin guardar, la plataforma pregunta: Guardar, Descartar o Seguir editando.');

// ---------------------------------------------------------------------------
// 5. Administración
// ---------------------------------------------------------------------------
h1('5. Administración (solo administradores)');
nota('Los comandos de esta sección se corren en el servidor (VM de Proxmox en Medellín, usuario activos) por SSH, desde la carpeta ~/riwistock. Antes de cualquier operación que borre datos, sacar un respaldo.');

h2('Crear una cuenta de acceso');
p('Generar la contraseña temporal en el gestor de contraseñas corporativo. El comando la pide dos veces y no la muestra en pantalla. Rol: admin o tecnico.');
codigo('sudo docker compose -f docker-compose.produccion.yml exec -it app \\\n  node dist/herramientas/crear-usuario.cjs correo@riwi.io "Nombre Apellido" tecnico --temporal');

h2('Actualizar la plataforma');
codigo('cd ~/riwistock\ngit pull\nbash desplegar.sh');
p('El despliegue saca un respaldo, aplica los cambios y las migraciones de base de datos, y comprueba que la plataforma responda.');

h2('Respaldos');
lista([
  ['Automático:', 'todos los días a las 3:15 a. m. (hora de Bogotá). Se conservan las últimas 14 copias, comprobadas al crearse.'],
  ['Manual:', 'sudo bash db/respaldar.sh'],
]);

h2('Crear una sede');
p('Sedes → Nueva sede (solo administradores). Nombre y ciudad son obligatorios: una sede sin ciudad es como la plataforma reconoce a "Remoto".');

h2('Borrar un equipo registrado por error');
p('Solo para equipos que no debieron existir (duplicados, pruebas, altas mal digitadas). Si el equipo existió y salió del inventario, lo correcto es "Dar de baja". Primero un ensayo que no borra nada; luego el borrado real:');
codigo('sudo bash db/borrar-equipo.sh "ETIQUETA"\nsudo CONFIRMAR=BORRAR bash db/borrar-equipo.sh "ETIQUETA" --en-serio');

// ---------------------------------------------------------------------------
// 6. Estado y contacto
// ---------------------------------------------------------------------------
h1('6. Estado de la información');
tabla([
  ['Empresa', 'Estado'],
  ['RIWI', 'Cargada.'],
  ['Blackbird Labs', 'Cargada.'],
  ['Emerald Fire', 'En migración durante esta semana.'],
]);
p('Dudas, errores o solicitudes de cuenta: Kevin Cardona, Analista de TI.');

// ---------------------------------------------------------------------------
// Encabezado y pie en cada página (menos la portada)
// ---------------------------------------------------------------------------
const rango = doc.bufferedPageRange();
for (let i = 1; i < rango.count; i++) {
  doc.switchToPage(i);
  const abajo = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.marca).text('RiwiStock', X0, 34, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor(C.suave).text('Manual de uso y operación', X0, 34, {
    width: ANCHO, align: 'right', lineBreak: false,
  });
  doc.moveTo(X0, 48).lineTo(X0 + ANCHO, 48).lineWidth(0.5).strokeColor(C.linea).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(C.suave).text(
    `Uso interno · Página ${i} de ${rango.count - 1}`,
    X0, doc.page.height - 40, { width: ANCHO, align: 'center', lineBreak: false },
  );
  doc.page.margins.bottom = abajo;
}

doc.end();
console.log('PDF:', SALIDA);
