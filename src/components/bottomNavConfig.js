import { DollarSign, LayoutGrid, Package, ClipboardList, KeyRound } from 'lucide-react'

// Configuracion de la barra de navegacion inferior (BottomNav).
// Cada item: { ruta, label, icono, roles }
// - ruta:   valor que recibe setPantalla en App.jsx
// - label:  texto para tooltip / accesibilidad (por ahora no se muestra debajo del icono)
// - icono:  componente de lucide-react. Para cambiarlo por un icono a medida
//           mas adelante se reemplaza solo esta referencia, o se pasa un
//           componente propio con la misma firma (props: size, color, strokeWidth).
// - roles:  roles que ven este item.
//
// El orden del array es el orden en que aparecen los botones.
export const NAV_ITEMS = [
  { ruta: 'dashboard', label: 'Dashboard', icono: DollarSign,    roles: ['dueno'] },
  { ruta: 'mesas',     label: 'Mesas',     icono: LayoutGrid,    roles: ['dueno', 'mozo'] },
  { ruta: 'stock',     label: 'Stock',     icono: Package,       roles: ['dueno'] },
  { ruta: 'resumen',   label: 'Resumen',   icono: ClipboardList, roles: ['dueno', 'mozo'] },
  { ruta: 'codigo',    label: 'Código de acceso', icono: KeyRound, roles: ['dueno'] },
]

export const COLOR_ACTIVO = '#1a73e8'
export const COLOR_INACTIVO = '#888'

// Alto de la barra (incluye su padding). App.jsx lo usa para reservar espacio
// al final del contenido y que la barra fija no tape nada.
export const ALTO_BOTTOM_NAV = 64
