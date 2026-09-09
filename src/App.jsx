import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured, getStoredCredentials, saveSupabaseCredentials } from './supabaseClient'
import {
  Sparkles,
  Calendar,
  Clock,
  DollarSign,
  User,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  PlusCircle,
  Database,
  RefreshCw,
  Trash2,
  Heart,
  X,
  AlertCircle
} from 'lucide-react'
import './App.css'

// Helper para formatear un objeto Date a string YYYY-MM-DD
const formatDateToStr = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper para obtener la fecha local de hoy en formato YYYY-MM-DD sin desfase horario
const getLocalTodayString = () => {
  return formatDateToStr(new Date())
}

// Helpers de normalización de estado
const isCitaCompleted = (c) => String(c.estado || '').toLowerCase() === 'completada'
const isCitaCanceled = (c) => String(c.estado || '').toLowerCase() === 'cancelada'
const isCitaPending = (c) => !isCitaCompleted(c) && !isCitaCanceled(c)

// Formato de texto de fecha amigable
const formatHumanDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const [year, month, day] = dateStr.split('-')
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    return d.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  } catch {
    return dateStr
  }
}

// Formateador de moneda MXN
const formatMoney = (val) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val || 0)
}

// Lista de servicios predefinidos con sugerencia de precio
const PRESET_SERVICES = [
  { name: 'Uñas Acrílicas', price: 450 },
  { name: 'Gelish Semipermanente', price: 220 },
  { name: 'Pedicure Spa Deluxe', price: 380 },
  { name: 'Manicure Ruso', price: 320 },
  { name: 'Retiro & Baño Acrílico', price: 180 },
  { name: 'Diseño & Nail Art', price: 150 },
  { name: 'Lash Lifting & Cejas', price: 400 },
]

// Citas iniciales de demostración para el primer uso con id UUID y nombre_cliente
const INITIAL_DEMO_CITAS = [
  {
    id: 'e1a2b3c4-0001-4000-8000-000000000001',
    nombre_cliente: 'Camila Morales',
    servicio: 'Uñas Acrílicas',
    fecha: getLocalTodayString(),
    hora: '10:00',
    precio: 450,
    estado: 'completada',
    created_at: new Date().toISOString()
  },
  {
    id: 'e1a2b3c4-0002-4000-8000-000000000002',
    nombre_cliente: 'Valeria Sánchez',
    servicio: 'Gelish Semipermanente',
    fecha: getLocalTodayString(),
    hora: '11:30',
    precio: 220,
    estado: 'pendiente',
    created_at: new Date().toISOString()
  },
  {
    id: 'e1a2b3c4-0003-4000-8000-000000000003',
    nombre_cliente: 'Sofía Herrera',
    servicio: 'Pedicure Spa Deluxe',
    fecha: getLocalTodayString(),
    hora: '14:00',
    precio: 380,
    estado: 'pendiente',
    created_at: new Date().toISOString()
  },
  {
    id: 'e1a2b3c4-0004-4000-8000-000000000004',
    nombre_cliente: 'Fernanda Ortiz',
    servicio: 'Manicure Ruso',
    fecha: getLocalTodayString(),
    hora: '16:30',
    precio: 320,
    estado: 'completada',
    created_at: new Date().toISOString()
  }
]

export default function App() {
  const todayString = useMemo(() => getLocalTodayString(), [])

  // Referencia para desplazamiento suave al detalle del día
  const dayDetailsRef = useRef(null)

  // Estado de citas (inicia con caché local o datos de demostración)
  const [citas, setCitas] = useState(() => {
    try {
      const saved = localStorage.getItem('SPASALON_CACHED_CITAS')
      if (saved) return JSON.parse(saved)
    } catch {
      // Ignorar error de parsing
    }
    return INITIAL_DEMO_CITAS
  })

  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado de la conexión
  const [isOnline, setIsOnline] = useState(() => isSupabaseConfigured())
  const [dbError, setDbError] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showQuickBookModal, setShowQuickBookModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [copiedSql, setCopiedSql] = useState(false)

  // Día seleccionado en el calendario
  const [selectedDate, setSelectedDate] = useState(todayString)
  // Controla si se muestra el panel de detalle de citas de la fecha seleccionada
  const [showSelectedDayCitas, setShowSelectedDayCitas] = useState(true)

  // Estado para el mes visualizado en el Calendario Interactivo
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Formulario para agendar cita
  const [formData, setFormData] = useState({
    cliente: '',
    servicio: 'Uñas Acrílicas',
    fecha: todayString,
    hora: '10:00',
    precio: '450',
    estado: 'pendiente'
  })

  // Modal de credenciales
  const [configCredentials, setConfigCredentials] = useState(() => getStoredCredentials())

  // Mostrar alerta toast temporal
  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Guardar en almacenamiento local
  const updateLocalCitas = (newCitas) => {
    setCitas(newCitas)
    localStorage.setItem('SPASALON_CACHED_CITAS', JSON.stringify(newCitas))
  }

  // Sincronizar citas desde Supabase
  const reloadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsOnline(false)
      showToast('Supabase aún no está configurado con credenciales válidas.', 'info')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('citas')
        .select('*')
        .order('hora', { ascending: true })

      if (error) throw error

      setCitas(data || [])
      setIsOnline(true)
      setDbError(null)
      localStorage.setItem('SPASALON_CACHED_CITAS', JSON.stringify(data || []))
      showToast('Citas sincronizadas con Supabase')
    } catch (err) {
      console.warn('Aviso: no se pudo sincronizar con Supabase, usando almacenamiento local:', err.message)
      setDbError(err.message)
      setIsOnline(false)
      showToast('Error de conexión a Supabase. Se mantienen datos locales.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Suscripción Realtime a Supabase
  useEffect(() => {
    let isMounted = true

    const syncInitial = async () => {
      if (!isSupabaseConfigured()) return
      try {
        const { data, error } = await supabase
          .from('citas')
          .select('*')
          .order('hora', { ascending: true })

        if (error) throw error
        if (isMounted && data) {
          setCitas(data)
          setIsOnline(true)
          setDbError(null)
          localStorage.setItem('SPASALON_CACHED_CITAS', JSON.stringify(data))
        }
      } catch (err) {
        console.warn('Aviso: error en sincronización inicial con Supabase:', err.message)
        if (isMounted) {
          setDbError(err.message)
          setIsOnline(false)
        }
      }
    }

    syncInitial()

    let channel = null
    try {
      if (isSupabaseConfigured()) {
        channel = supabase
          .channel('citas_realtime_simplified')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'citas' },
            () => {
              syncInitial()
            }
          )
          .subscribe()
      }
    } catch (err) {
      console.log('Realtime subscription error:', err)
    }

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  // =========================================================
  // 1. MÉTRICAS EXCLUSIVAS DEL DÍA DE HOY (TOP SUMMARY BAR)
  // =========================================================
  const todayMetrics = useMemo(() => {
    const todayCitas = citas.filter(c => c.fecha === todayString && !isCitaCanceled(c))
    const completedToday = todayCitas.filter(c => isCitaCompleted(c))
    const pendingToday = todayCitas.filter(c => isCitaPending(c))

    const expectedRevenue = todayCitas.reduce((sum, c) => sum + Number(c.precio || 0), 0)
    const earnedRevenue = completedToday.reduce((sum, c) => sum + Number(c.precio || 0), 0)

    return {
      totalCount: todayCitas.length,
      completedCount: completedToday.length,
      pendingCount: pendingToday.length,
      expectedRevenue,
      earnedRevenue
    }
  }, [citas, todayString])

  // Mapeo de citas agrupadas por fecha (para el calendario de disponibilidad)
  const appointmentsByDate = useMemo(() => {
    const map = {}
    citas.forEach(cita => {
      if (!cita.fecha || isCitaCanceled(cita)) return
      if (!map[cita.fecha]) {
        map[cita.fecha] = []
      }
      map[cita.fecha].push(cita)
    })
    return map
  }, [citas])

  // Citas del día seleccionado (ordenadas por hora)
  const selectedDayCitas = useMemo(() => {
    return citas
      .filter(c => c.fecha === selectedDate)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
  }, [citas, selectedDate])

  const selectedDayHasCitas = selectedDayCitas.length > 0

  // Métricas del día seleccionado
  const selectedDaySummary = useMemo(() => {
    const active = selectedDayCitas.filter(c => !isCitaCanceled(c))
    const completed = active.filter(c => isCitaCompleted(c))
    const totalExpected = active.reduce((sum, c) => sum + Number(c.precio || 0), 0)
    const totalEarned = completed.reduce((sum, c) => sum + Number(c.precio || 0), 0)
    return {
      total: active.length,
      completed: completed.length,
      totalExpected,
      totalEarned
    }
  }, [selectedDayCitas])

  // =========================================================
  // DÍAS DEL CALENDARIO
  // =========================================================
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days = []

    // Días del mes anterior (relleno)
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevDate = new Date(year, month - 1, d)
      days.push({
        date: prevDate,
        dateStr: formatDateToStr(prevDate),
        dayNumber: d,
        isCurrentMonth: false
      })
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d)
      days.push({
        date: currDate,
        dateStr: formatDateToStr(currDate),
        dayNumber: d,
        isCurrentMonth: true
      })
    }

    // Días del mes siguiente (relleno)
    const remaining = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d)
      days.push({
        date: nextDate,
        dateStr: formatDateToStr(nextDate),
        dayNumber: d,
        isCurrentMonth: false
      })
    }

    return days
  }, [calendarMonth])

  // Navegación de mes
  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleGoToToday = () => {
    const now = new Date()
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(todayString)
    setShowSelectedDayCitas(true)
  }

  // =========================================================
  // INTERACCIÓN AL HACER CLIC EN UN DÍA DEL CALENDARIO
  // =========================================================
  const handleSelectCalendarDay = (day) => {
    const dateStr = day.dateStr
    setSelectedDate(dateStr)

    // Sincronizar mes si es de otro mes
    if (!day.isCurrentMonth) {
      setCalendarMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1))
    }

    const dayCitas = appointmentsByDate[dateStr] || []
    const isBusy = dayCitas.length > 0

    if (isBusy) {
      // 1. DÍA OCUPADO (Tiene citas):
      // Despliega únicamente las citas de esa fecha seleccionada
      setShowSelectedDayCitas(true)
      showToast(`🔴 Mostrando ${dayCitas.length} ${dayCitas.length === 1 ? 'cita' : 'citas'} del ${formatHumanDate(dateStr)}`, 'info')

      setTimeout(() => {
        if (dayDetailsRef.current) {
          dayDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
    } else {
      // 2. DÍA LIBRE / DISPONIBLE (Sin citas):
      // Abre automáticamente el modal/formulario para agendar una nueva cita
      setFormData(prev => ({
        ...prev,
        cliente: '',
        fecha: dateStr,
        hora: '10:00',
        precio: '450',
        estado: 'pendiente'
      }))
      setShowQuickBookModal(true)
      showToast(`🟢 Día libre: Listo para agendar cita el ${formatHumanDate(dateStr)}`, 'success')
    }
  }

  // Abrir modal de agendar con fecha específica o actual
  const handleOpenNewAppointmentModal = (targetDate = selectedDate) => {
    setFormData(prev => ({
      ...prev,
      cliente: '',
      fecha: targetDate || todayString,
      hora: '10:00',
      precio: '450',
      estado: 'pendiente'
    }))
    setShowQuickBookModal(true)
  }

  // Guardar cita
  const handleSubmitCita = async (e) => {
    e.preventDefault()
    if (!formData.cliente.trim()) {
      showToast('Por favor escribe el nombre de la clienta.', 'error')
      return
    }

    setIsSubmitting(true)

    const nuevaCita = {
      nombre_cliente: formData.cliente.trim(),
      servicio: formData.servicio.trim(),
      fecha: formData.fecha,
      hora: formData.hora,
      precio: parseFloat(formData.precio) || 0,
      estado: formData.estado.toLowerCase()
    }

    if (isOnline && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('citas')
          .insert([nuevaCita])
          .select()

        if (error) throw error

        if (data && data[0]) {
          setCitas(prev => [...prev, data[0]])
        } else {
          reloadFromSupabase()
        }
        showToast('¡Cita registrada con éxito en Supabase!')
      } catch (err) {
        console.error('Error al insertar en Supabase:', err)
        const localUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : 'demo-' + Date.now()
        const citaConId = { ...nuevaCita, id: localUuid, created_at: new Date().toISOString() }
        updateLocalCitas([...citas, citaConId])
        showToast('Guardada en almacenamiento local')
      }
    } else {
      const localUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'demo-' + Date.now()
      const citaConId = { ...nuevaCita, id: localUuid, created_at: new Date().toISOString() }
      updateLocalCitas([...citas, citaConId])
      showToast('¡Cita registrada correctamente!')
    }

    // Seleccionar y mostrar el día de la cita creada
    setSelectedDate(nuevaCita.fecha)
    setShowSelectedDayCitas(true)
    setShowQuickBookModal(false)

    // Resetear formulario
    setFormData(prev => ({
      ...prev,
      cliente: '',
      servicio: 'Uñas Acrílicas',
      precio: '450',
      estado: 'pendiente'
    }))
    setIsSubmitting(false)
  }

  // Acciones rápidas de estado de cita
  const handleUpdateStatus = async (id, newStatus) => {
    const normalizedStatus = newStatus.toLowerCase()

    if (isOnline && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('citas')
          .update({ estado: normalizedStatus })
          .eq('id', id)

        if (error) throw error

        setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: normalizedStatus } : c))
        showToast(`Cita marcada como "${newStatus}"`)
      } catch (err) {
        console.error('Error al actualizar en Supabase:', err)
        const updated = citas.map(c => c.id === id ? { ...c, estado: normalizedStatus } : c)
        updateLocalCitas(updated)
        showToast(`Cita actualizada a "${newStatus}"`)
      }
    } else {
      const updated = citas.map(c => c.id === id ? { ...c, estado: normalizedStatus } : c)
      updateLocalCitas(updated)
      showToast(`Cita marcada como "${newStatus}"`)
    }
  }

  // Eliminar cita permanentemente
  const handleDeleteCita = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta cita permanentemente?')) return

    if (isOnline && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('citas')
          .delete()
          .eq('id', id)

        if (error) throw error

        setCitas(prev => prev.filter(c => c.id !== id))
        showToast('Cita eliminada')
      } catch (err) {
        console.error('Error al eliminar en Supabase:', err)
        const updated = citas.filter(c => c.id !== id)
        updateLocalCitas(updated)
        showToast('Cita eliminada')
      }
    } else {
      const updated = citas.filter(c => c.id !== id)
      updateLocalCitas(updated)
      showToast('Cita eliminada')
    }
  }

  // Guardar credenciales de Supabase
  const handleSaveCredentials = (e) => {
    e.preventDefault()
    saveSupabaseCredentials(configCredentials.url, configCredentials.key)
    setShowConfigModal(false)
    showToast('Credenciales guardadas. Recargando conexión...')
    setTimeout(() => {
      window.location.reload()
    }, 600)
  }

  // Script SQL para Supabase
  const sqlSnippet = `-- 1. Habilitar extensión pgcrypto para UUIDs:
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Crear tabla de citas con id UUID y nombre_cliente:
CREATE TABLE IF NOT EXISTS public.citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nombre_cliente TEXT NOT NULL,
  servicio TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente'
);

-- 3. Habilitar RLS y política pública:
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso publico total a citas" 
  ON public.citas 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. Habilitar replicación en tiempo real:
ALTER PUBLICATION supabase_realtime ADD TABLE public.citas;`

  return (
    <div className="spa-app">
      {/* Toast de notificación temporal */}
      {toastMessage && (
        <div className={`toast-notice ${toastMessage.type === 'error' ? 'error' : toastMessage.type === 'info' ? 'info' : 'success'}`}>
          {toastMessage.type === 'error' ? (
            <XCircle size={18} />
          ) : toastMessage.type === 'info' ? (
            <Clock3 size={18} color="#D47A83" />
          ) : (
            <CheckCircle2 size={18} color="#2E7D5B" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ENCABEZADO DE MARCA & ESTADO */}
      <header className="spa-header">
        <div className="brand-wrapper">
          <div className="brand-logo-badge">
            <Sparkles size={24} />
          </div>
          <div className="brand-info">
            <h1>Lumière Studio</h1>
            <span className="brand-tagline">Nail Lounge & Beauty Bar</span>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className={`status-live-indicator ${isOnline ? 'online' : 'demo'}`}
            onClick={() => setShowConfigModal(true)}
            title="Estado de base de datos Supabase"
          >
            <span className={`pulse-dot ${isOnline ? 'green' : 'amber'}`}></span>
            <span>{isOnline ? 'Supabase en Vivo' : 'Modo Local / Demo'}</span>
          </button>

          <button 
            className="btn-header-icon"
            onClick={() => setShowConfigModal(true)}
            title="Configuración de base de datos y SQL"
          >
            <Database size={17} />
          </button>

          <button 
            className="btn-header-icon"
            onClick={reloadFromSupabase}
            title="Sincronizar citas"
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* =========================================================
          1. BARRA RESUMEN: CITAS DE HOY E INGRESOS ESPERADOS DE HOY
          ========================================================= */}
      <section className="today-summary-banner" aria-label="Resumen de Hoy">
        <div className="summary-banner-content">
          <div className="summary-date-badge">
            <div className="summary-date-icon">
              <Calendar size={20} />
            </div>
            <div>
              <span className="summary-badge-label">Agenda de Hoy</span>
              <h2 className="summary-badge-date">{formatHumanDate(todayString)}</h2>
            </div>
          </div>

          <div className="summary-metrics-row">
            {/* Citas de Hoy */}
            <div className="summary-metric-box">
              <div className="metric-box-icon blue">
                <CalendarDays size={20} />
              </div>
              <div className="metric-box-text">
                <span className="metric-box-title">Citas para Hoy</span>
                <div className="metric-box-main-value">
                  <strong>{todayMetrics.totalCount}</strong>
                  <span className="metric-box-unit">{todayMetrics.totalCount === 1 ? 'cita' : 'citas'}</span>
                </div>
                <span className="metric-box-sub">
                  {todayMetrics.completedCount} completadas • {todayMetrics.pendingCount} pendientes
                </span>
              </div>
            </div>

            {/* Ingresos Esperados de Hoy */}
            <div className="summary-metric-box">
              <div className="metric-box-icon gold">
                <DollarSign size={20} />
              </div>
              <div className="metric-box-text">
                <span className="metric-box-title">Ingresos Esperados Hoy</span>
                <div className="metric-box-main-value highlight">
                  {formatMoney(todayMetrics.expectedRevenue)}
                </div>
                <span className="metric-box-sub">
                  Cobrado: <strong>{formatMoney(todayMetrics.earnedRevenue)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Botón rápido para nueva cita */}
          <button 
            className="btn-banner-quick-add"
            onClick={() => handleOpenNewAppointmentModal(todayString)}
            title="Agendar nueva cita para hoy"
          >
            <PlusCircle size={18} />
            <span>Agendar Cita</span>
          </button>
        </div>
      </section>

      {/* =========================================================
          2. SECCIÓN PRINCIPAL: CALENDARIO INTERACTIVO
          ========================================================= */}
      <section className="spa-card calendar-main-card" aria-label="Calendario Interactivo">
        <div className="calendar-header-banner">
          <div>
            <h2 className="calendar-title">
              <Calendar size={22} color="#D47A83" />
              Calendario de Citas & Disponibilidad
            </h2>
            <p className="calendar-instructions">
              🔴 <strong>Días Ocupados:</strong> Haz clic para ver las citas de esa fecha. 🟢 <strong>Días Libres:</strong> Haz clic para agendar cita rápida.
            </p>
          </div>

          {/* Leyenda explicativa */}
          <div className="calendar-legend-bar">
            <div className="legend-item" title="Días con al menos 1 cita programada">
              <span className="legend-dot busy"></span>
              <span>🔴 Ocupado</span>
            </div>
            <div className="legend-item" title="Días sin citas programadas">
              <span className="legend-dot available"></span>
              <span>🟢 Disponible</span>
            </div>
            <div className="legend-item" title="Día seleccionado en pantalla">
              <span className="legend-dot selected"></span>
              <span>Seleccionado</span>
            </div>
          </div>
        </div>

        {/* Controles de navegación de mes */}
        <div className="calendar-top-controls">
          <div className="month-nav-group">
            <button 
              className="btn-month-nav" 
              onClick={handlePrevMonth}
              title="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="month-display-title">
              {calendarMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              className="btn-month-nav" 
              onClick={handleNextMonth}
              title="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button 
            className="btn-today-chip"
            onClick={handleGoToToday}
            title="Ir a la fecha actual"
          >
            Ir a Hoy
          </button>
        </div>

        {/* Cuadrícula interactiva del calendario */}
        <div className="calendar-grid-wrapper">
          <div className="calendar-weekdays-row">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(wd => (
              <div key={wd} className="weekday-header-cell">{wd}</div>
            ))}
          </div>

          <div className="calendar-days-grid">
            {calendarDays.map((day) => {
              const dayCitas = appointmentsByDate[day.dateStr] || []
              const hasCitas = dayCitas.length > 0
              const isSelected = day.dateStr === selectedDate
              const isToday = day.dateStr === todayString

              return (
                <div
                  key={day.dateStr}
                  className={`calendar-day-tile ${day.isCurrentMonth ? '' : 'other-month'} ${hasCitas ? 'busy' : 'available'} ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => handleSelectCalendarDay(day)}
                  title={`${day.dateStr}: ${hasCitas ? `${dayCitas.length} citas programadas. Clic para ver lista.` : 'Día libre. Clic para agendar.'}`}
                >
                  <div className="tile-top-row">
                    <span className="day-number-label">{day.dayNumber}</span>
                    {isToday && <span className="badge-today-mini">HOY</span>}
                  </div>

                  <div className="tile-content-indicator">
                    {hasCitas ? (
                      <span className="availability-pill busy">
                        <span className="legend-dot busy" style={{ width: '7px', height: '7px' }}></span>
                        <span>{dayCitas.length} {dayCitas.length === 1 ? 'cita' : 'citas'}</span>
                      </span>
                    ) : (
                      <span className="availability-pill available">
                        <span className="legend-dot available" style={{ width: '7px', height: '7px' }}></span>
                        <span>Libre</span>
                      </span>
                    )}
                  </div>

                  {hasCitas ? (
                    <div className="tile-citas-preview">
                      {dayCitas[0].nombre_cliente || dayCitas[0].cliente} ({dayCitas[0].hora})
                    </div>
                  ) : (
                    <span className="tile-action-hint">+ Agendar</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          3. DETALLE DE CITAS DEL DÍA SELECCIONADO (AL HACER CLIC EN DÍA OCUPADO)
          ========================================================= */}
      {showSelectedDayCitas && selectedDayHasCitas && (
        <section 
          ref={dayDetailsRef} 
          className="spa-card day-details-section animate-fade-in"
          aria-label="Citas de la fecha seleccionada"
        >
          <div className="day-details-header">
            <div className="day-details-title-wrap">
              <div className="day-details-icon">
                <Calendar size={22} color="#D47A83" />
              </div>
              <div>
                <h2>
                  Citas del {formatHumanDate(selectedDate)}
                </h2>
                <div className="day-details-sub-stats">
                  <span>{selectedDaySummary.total} {selectedDaySummary.total === 1 ? 'cita agendada' : 'citas agendadas'}</span>
                  <span>•</span>
                  <span>Ingreso proyectado: <strong>{formatMoney(selectedDaySummary.totalExpected)}</strong></span>
                  <span>•</span>
                  <span>Cobrado: <strong>{formatMoney(selectedDaySummary.totalEarned)}</strong></span>
                </div>
              </div>
            </div>

            <div className="day-details-actions">
              <button 
                className="btn-add-day-cita"
                onClick={() => handleOpenNewAppointmentModal(selectedDate)}
                title="Agregar otra cita en esta misma fecha"
              >
                <PlusCircle size={16} />
                <span>Agregar Cita</span>
              </button>

              <button 
                className="btn-close-details"
                onClick={() => setShowSelectedDayCitas(false)}
                title="Cerrar detalle"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="appointments-table-container">
            <table className="spa-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Clienta</th>
                  <th>Servicio</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayCitas.map((cita) => {
                  const clientName = cita.nombre_cliente || cita.cliente || 'Clienta'
                  const initials = clientName
                    .split(' ')
                    .map(p => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  const isDone = isCitaCompleted(cita)
                  const isPend = isCitaPending(cita)
                  const isCanc = isCitaCanceled(cita)

                  return (
                    <tr key={cita.id} className="animate-fade-in">
                      {/* Hora */}
                      <td>
                        <div className="time-slot-chip">
                          <Clock size={13} color="#78726D" />
                          <span>{cita.hora}</span>
                        </div>
                      </td>

                      {/* Clienta */}
                      <td>
                        <div className="client-cell">
                          <div className="client-avatar">{initials}</div>
                          <span className="client-name-bold">{clientName}</span>
                        </div>
                      </td>

                      {/* Servicio */}
                      <td>
                        <span className="service-badge">
                          {cita.servicio}
                        </span>
                      </td>

                      {/* Precio */}
                      <td>
                        <span className="price-display">
                          {formatMoney(cita.precio)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={`status-tag ${isDone ? 'completada' : isCanc ? 'cancelada' : 'pendiente'}`}>
                          {isDone && <CheckCircle2 size={13} />}
                          {isPend && <Clock3 size={13} />}
                          {isCanc && <XCircle size={13} />}
                          <span style={{ textTransform: 'capitalize' }}>{cita.estado}</span>
                        </span>
                      </td>

                      {/* Acciones */}
                      <td>
                        <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                          {isPend && (
                            <button
                              className="btn-action-pill complete"
                              onClick={() => handleUpdateStatus(cita.id, 'completada')}
                              title="Marcar como atendida y sumar a ingresos"
                            >
                              <CheckCircle2 size={13} />
                              Completar
                            </button>
                          )}

                          {isDone && (
                            <button
                              className="btn-action-pill reopen"
                              onClick={() => handleUpdateStatus(cita.id, 'pendiente')}
                              title="Reabrir a estado pendiente"
                            >
                              <Clock3 size={13} />
                              Reabrir
                            </button>
                          )}

                          {!isCanc && (
                            <button
                              className="btn-action-icon-only"
                              onClick={() => handleUpdateStatus(cita.id, 'cancelada')}
                              title="Cancelar cita"
                            >
                              <XCircle size={16} />
                            </button>
                          )}

                          <button
                            className="btn-action-icon-only"
                            onClick={() => handleDeleteCita(cita.id)}
                            title="Eliminar cita permanentemente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =========================================================
          MODAL FLOTANTE: AGENDAR NUEVA CITA (AL CLIC EN DÍA LIBRE O BOTÓN)
          ========================================================= */}
      {showQuickBookModal && (
        <div className="modal-overlay" onClick={() => setShowQuickBookModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Sparkles size={20} color="#D47A83" />
                Agendar Nueva Cita
              </h3>
              <button 
                className="btn-action-icon-only"
                onClick={() => setShowQuickBookModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-date-notice">
                <CheckCircle2 size={16} />
                <span>Fecha seleccionada: <strong style={{ textTransform: 'capitalize' }}>{formatHumanDate(formData.fecha)}</strong></span>
              </div>

              <form onSubmit={handleSubmitCita} className="booking-form">
                {/* Nombre de la Clienta */}
                <div className="form-group">
                  <label className="form-label">Nombre de la Clienta</label>
                  <div className="input-with-icon">
                    <span className="input-icon-left">
                      <User size={17} />
                    </span>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Ej. Ana Sofía Garza"
                      className="spa-input"
                      value={formData.cliente}
                      onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    />
                  </div>
                </div>

                {/* Servicio y sugerencias de precio */}
                <div className="form-group">
                  <label className="form-label">Servicio</label>
                  <div className="quick-services-wrap">
                    {PRESET_SERVICES.map((serv) => (
                      <button
                        type="button"
                        key={serv.name}
                        className={`chip-service ${formData.servicio === serv.name ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, servicio: serv.name, precio: String(serv.price) })}
                      >
                        {serv.name}
                      </button>
                    ))}
                  </div>

                  <div className="input-with-icon" style={{ marginTop: '6px' }}>
                    <span className="input-icon-left">
                      <Sparkles size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      className="spa-input"
                      value={formData.servicio}
                      onChange={(e) => setFormData({ ...formData, servicio: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha y Hora */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Fecha</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">
                        <Calendar size={16} />
                      </span>
                      <input
                        type="date"
                        required
                        className="spa-input"
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hora</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">
                        <Clock size={16} />
                      </span>
                      <input
                        type="time"
                        required
                        className="spa-input"
                        value={formData.hora}
                        onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Precio y Estado Inicial */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Precio ($ MXN)</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">
                        <DollarSign size={16} />
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        required
                        className="spa-input"
                        value={formData.precio}
                        onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado Inicial</label>
                    <div className="status-pill-group">
                      <button
                        type="button"
                        className={`status-select-btn ${formData.estado === 'pendiente' ? 'active pending' : ''}`}
                        onClick={() => setFormData({ ...formData, estado: 'pendiente' })}
                      >
                        <Clock3 size={14} />
                        Pendiente
                      </button>
                      <button
                        type="button"
                        className={`status-select-btn ${formData.estado === 'completada' ? 'active completed' : ''}`}
                        onClick={() => setFormData({ ...formData, estado: 'completada' })}
                      >
                        <CheckCircle2 size={14} />
                        Completada
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-submit-booking"
                  disabled={isSubmitting}
                  style={{ marginTop: '8px' }}
                >
                  <Heart size={18} />
                  <span>{isSubmitting ? 'Guardando cita...' : 'Confirmar y Agendar Cita'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE CONFIGURACIÓN SUPABASE & SQL
          ========================================================= */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configuración de Supabase</h3>
              <button 
                className="btn-action-icon-only"
                onClick={() => setShowConfigModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {dbError && (
                <div className="modal-error-box">
                  <AlertCircle size={18} />
                  <span>Aviso de conexión: {dbError}</span>
                </div>
              )}

              <p style={{ fontSize: '13.5px', color: '#524D48', marginBottom: '16px' }}>
                Conecta tu proyecto de Supabase en tiempo real agregando tus credenciales aquí o en el archivo <code>.env</code>:
              </p>

              <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Project URL de Supabase</label>
                  <input
                    type="url"
                    placeholder="https://xxxx.supabase.co"
                    className="spa-input"
                    value={configCredentials.url}
                    onChange={(e) => setConfigCredentials({ ...configCredentials, url: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Anon / Public API Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                    className="spa-input"
                    value={configCredentials.key}
                    onChange={(e) => setConfigCredentials({ ...configCredentials, key: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn-submit-booking" style={{ marginTop: '6px' }}>
                  Guardar y Conectar
                </button>
              </form>

              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#2A2725' }}>
                  Script SQL para tu base de datos:
                </h4>
                <p style={{ fontSize: '12.5px', color: '#78726D', marginTop: '4px' }}>
                  Copia y pega este script en el <strong>SQL Editor</strong> de tu panel de Supabase:
                </p>

                <div className="sql-code-box">
                  <button 
                    className="copy-sql-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(sqlSnippet)
                      setCopiedSql(true)
                      setTimeout(() => setCopiedSql(false), 2000)
                    }}
                  >
                    {copiedSql ? '¡Copiado!' : 'Copiar SQL'}
                  </button>
                  <pre>{sqlSnippet}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
