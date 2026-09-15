import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'
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
  RefreshCw,
  Trash2,
  Heart,
  X,
  Receipt,
  ArrowDownLeft,
  Pencil,
  Search,
  Filter,
  LogOut,
  Home,
  Users,
  BriefcaseBusiness
} from 'lucide-react'
import './App.css'

const formatDateToStr = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getLocalTodayString = () => formatDateToStr(new Date())

const isCitaCompleted = (c) => {
  const estado = String(c.estado || '').toLowerCase()
  return estado === 'completada' || estado === 'confirmada'
}

const isCitaCanceled = (c) => String(c.estado || '').toLowerCase() === 'cancelada'
const isCitaPending = (c) => !isCitaCompleted(c) && !isCitaCanceled(c)

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

const formatMoney = (val) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val || 0)
}

const formatTime12Hour = (time) => {
  if (!time) return 'Sin hora'

  const [hoursValue, minutesValue] = String(time).split(':')
  const hours = Number(hoursValue)
  const minutes = minutesValue || '00'

  if (Number.isNaN(hours)) return time

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`
}

const PRESET_SERVICES = [
  { name: 'Uñas Acrílicas', price: 450 },
  { name: 'Gelish Semipermanente', price: 220 },
  { name: 'Pedicure Spa Deluxe', price: 380 },
  { name: 'Manicure Ruso', price: 320 },
  { name: 'Retiro & Baño Acrílico', price: 180 },
  { name: 'Diseño & Nail Art', price: 150 },
  { name: 'Lash Lifting & Cejas', price: 400 }
]

const getEstadoLabel = (estado) => {
  const normalized = String(estado || '').toLowerCase()
  if (normalized === 'completada' || normalized === 'confirmada') return 'Confirmada'
  if (normalized === 'cancelada') return 'Cancelada'
  return 'Pendiente'
}

export default function App() {
  const todayString = useMemo(() => getLocalTodayString(), [])
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOnline, setIsOnline] = useState(() => isSupabaseConfigured())
  const [showQuickBookModal, setShowQuickBookModal] = useState(false)
  const [showIncomeHistoryModal, setShowIncomeHistoryModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayString)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [activeView, setActiveView] = useState('citas')
  const [editingCitaId, setEditingCitaId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [formData, setFormData] = useState({
    cliente: '',
    servicio: 'Uñas Acrílicas',
    fecha: todayString,
    hora: '10:00',
    precio: '450',
    estado: 'pendiente'
  })

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const reloadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsOnline(false)
      console.warn('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
      showToast('Supabase no está configurado.', 'error')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('citas')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true })

      if (error) throw error

      setCitas(data || [])
      setIsOnline(true)
    } catch (err) {
      console.error('No se pudo sincronizar con Supabase:', err)
      setIsOnline(false)
      setCitas([])
      showToast('Error de conexión a Supabase.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const syncInitial = async () => {
      if (!isSupabaseConfigured()) return
      try {
        const { data, error } = await supabase
          .from('citas')
          .select('*')
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true })

        if (error) throw error
        if (isMounted && data) {
          setCitas(data)
          setIsOnline(true)
        }
      } catch (err) {
        console.error('Error en sincronización inicial con Supabase:', err)
        if (isMounted) {
          setIsOnline(false)
          setCitas([])
        }
      }
    }

    syncInitial()

    let channel = null
    try {
      if (isSupabaseConfigured()) {
        channel = supabase
          .channel('citas_realtime_simplified')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
            syncInitial()
          })
          .subscribe()
      }
    } catch (err) {
      console.error('Realtime subscription error:', err)
    }

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const todayMetrics = useMemo(() => {
    const todayCitas = citas.filter(c => c.fecha === todayString && !isCitaCanceled(c))
    const completedToday = todayCitas.filter(c => isCitaCompleted(c))
    const pendingToday = todayCitas.filter(c => isCitaPending(c))

    return {
      totalCount: todayCitas.length,
      completedCount: completedToday.length,
      pendingCount: pendingToday.length,
      expectedRevenue: todayCitas.reduce((sum, c) => sum + Number(c.precio || 0), 0),
      earnedRevenue: completedToday.reduce((sum, c) => sum + Number(c.precio || 0), 0)
    }
  }, [citas, todayString])

  const monthlyMetrics = useMemo(() => {
    const monthPrefix = todayString.slice(0, 7)
    const monthCitas = citas.filter(cita => cita.fecha?.startsWith(monthPrefix) && !isCitaCanceled(cita))
    const completed = monthCitas.filter(cita => isCitaCompleted(cita))

    return {
      expectedRevenue: monthCitas.reduce((sum, cita) => sum + Number(cita.precio || 0), 0),
      earnedRevenue: completed.reduce((sum, cita) => sum + Number(cita.precio || 0), 0)
    }
  }, [citas, todayString])

  const incomeTransactions = useMemo(() => {
    const monthPrefix = todayString.slice(0, 7)

    return citas
      .filter(cita => isCitaCompleted(cita) && !isCitaCanceled(cita) && cita.fecha?.startsWith(monthPrefix))
      .sort((a, b) => `${b.fecha}T${b.hora || '00:00'}`.localeCompare(`${a.fecha}T${a.hora || '00:00'}`))
  }, [citas, todayString])

  const appointmentsByDate = useMemo(() => {
    const map = {}
    citas.forEach(cita => {
      if (!cita.fecha || isCitaCanceled(cita)) return
      if (!map[cita.fecha]) map[cita.fecha] = []
      map[cita.fecha].push(cita)
    })
    return map
  }, [citas])

  const weeklySchedule = useMemo(() => {
    const schedule = [
      { dayIndex: 1, day: 'Lunes', hours: '09:00 AM - 06:00 PM' },
      { dayIndex: 2, day: 'Martes', hours: '09:00 AM - 06:00 PM' },
      { dayIndex: 3, day: 'Miércoles', hours: '09:00 AM - 06:00 PM' },
      { dayIndex: 4, day: 'Jueves', hours: '09:00 AM - 06:00 PM' },
      { dayIndex: 5, day: 'Viernes', hours: '09:00 AM - 06:00 PM' },
      { dayIndex: 6, day: 'Sábado', hours: '09:00 AM - 03:00 PM' },
      { dayIndex: 0, day: 'Domingo', hours: null }
    ]

    return schedule.map(({ dayIndex, day, hours }) => ({
      day,
      hours,
      appointments: citas
        .filter(cita => {
          if (!cita.fecha || isCitaCanceled(cita)) return false
          const [year, month, date] = cita.fecha.split('-').map(Number)
          return new Date(year, month - 1, date).getDay() === dayIndex
        })
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
    }))
  }, [citas])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    const days = []

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevDate = new Date(year, month - 1, d)
      days.push({ date: prevDate, dateStr: formatDateToStr(prevDate), dayNumber: d, isCurrentMonth: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d)
      days.push({ date: currDate, dateStr: formatDateToStr(currDate), dayNumber: d, isCurrentMonth: true })
    }

    const remaining = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d)
      days.push({ date: nextDate, dateStr: formatDateToStr(nextDate), dayNumber: d, isCurrentMonth: false })
    }

    return days
  }, [calendarMonth])

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
  }

  const handleSelectCalendarDay = (day) => {
    const dateStr = day.dateStr
    setSelectedDate(dateStr)
    if (!day.isCurrentMonth) {
      setCalendarMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1))
    }
    handleOpenNewAppointmentModal(dateStr)
  }

  const handleOpenNewAppointmentModal = (targetDate = selectedDate) => {
    setEditingCitaId(null)
    setFormData({
      cliente: '',
      servicio: 'Uñas Acrílicas',
      fecha: targetDate || todayString,
      hora: '10:00',
      precio: '450',
      estado: 'pendiente'
    })
    setShowQuickBookModal(true)
  }

  const handleOpenEditAppointmentModal = (cita) => {
    setEditingCitaId(cita.id)
    setFormData({
      cliente: cita.nombre_cliente || cita.cliente || '',
      servicio: cita.servicio || 'Uñas Acrílicas',
      fecha: cita.fecha || todayString,
      hora: cita.hora || '10:00',
      precio: String(cita.precio ?? 0),
      estado: String(cita.estado || 'pendiente')
    })
    setShowQuickBookModal(true)
  }

  const handleSubmitCita = async (e) => {
    e.preventDefault()
    if (!formData.cliente.trim()) {
      showToast('Por favor escribe el nombre de la clienta.', 'error')
      return
    }

    const payload = {
      nombre_cliente: formData.cliente.trim(),
      servicio: formData.servicio.trim(),
      fecha: formData.fecha,
      hora: formData.hora,
      precio: Number(formData.precio) || 0,
      estado: formData.estado.toLowerCase()
    }

    setIsSubmitting(true)

    if (isOnline && isSupabaseConfigured()) {
      try {
        if (editingCitaId !== null) {
          const { data, error } = await supabase
            .from('citas')
            .update(payload)
            .eq('id', editingCitaId)
            .select()

          if (error) throw error

          if (data && data[0]) {
            setCitas(prev => prev.map(c => c.id === editingCitaId ? data[0] : c))
            showToast('Cita actualizada con éxito.')
          } else {
            reloadFromSupabase()
          }
        } else {
          const { data, error } = await supabase
            .from('citas')
            .insert([payload])
            .select()

          if (error) throw error

          if (data && data[0]) {
            setCitas(prev => [...prev, data[0]])
          } else {
            reloadFromSupabase()
          }
          showToast('¡Cita registrada con éxito en Supabase!')
        }
      } catch (err) {
        console.error('Error al guardar en Supabase:', err)
        setIsOnline(false)
        showToast('No se pudo guardar la cita.', 'error')
        setIsSubmitting(false)
        return
      }
    } else {
      console.warn('No se puede guardar la cita: Supabase no está configurado.')
      showToast('Configura Supabase para guardar citas.', 'error')
      setIsSubmitting(false)
      return
    }

    setSelectedDate(payload.fecha)
    setEditingCitaId(null)
    setShowQuickBookModal(false)
    setFormData({
      cliente: '',
      servicio: 'Uñas Acrílicas',
      fecha: payload.fecha,
      hora: '10:00',
      precio: '450',
      estado: 'pendiente'
    })
    setIsSubmitting(false)
  }

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
        setIsOnline(false)
        showToast('No se pudo actualizar la cita.', 'error')
      }
    } else {
      showToast('Configura Supabase para actualizar citas.', 'error')
    }
  }

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
        setIsOnline(false)
        showToast('No se pudo eliminar la cita.', 'error')
      }
    } else {
      showToast('Configura Supabase para eliminar citas.', 'error')
    }
  }

  const uniqueServices = useMemo(() => ['Todos', ...new Set(citas.map(cita => cita.servicio).filter(Boolean))], [citas])

  const filteredCitas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return [...citas]
      .filter(cita => {
        const cliente = (cita.nombre_cliente || cita.cliente || '').toLowerCase()
        const servicio = (cita.servicio || '').toLowerCase()
        const estado = String(cita.estado || '').toLowerCase()
        const matchesQuery = !query || cliente.includes(query) || servicio.includes(query) || (cita.fecha || '').includes(query)
        const matchesCategory = categoryFilter === 'Todos' || cita.servicio === categoryFilter
        const matchesStatus = statusFilter === 'todos'
          || (statusFilter === 'confirmada' && (estado === 'completada' || estado === 'confirmada'))
          || estado === statusFilter
        const matchesDate = !dateFilter || cita.fecha === dateFilter

        return matchesQuery && matchesCategory && matchesStatus && matchesDate
      })
      .sort((a, b) => `${b.fecha}T${b.hora || '00:00'}`.localeCompare(`${a.fecha}T${a.hora || '00:00'}`))
  }, [citas, searchTerm, categoryFilter, statusFilter, dateFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCitas.length / 6))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const currentCitas = filteredCitas.slice((currentPage - 1) * 6, currentPage * 6)
  const selectedDateCitas = useMemo(() => {
    return citas
      .filter(cita => cita.fecha === selectedDate && !isCitaCanceled(cita))
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
  }, [citas, selectedDate])

  return (
    <div className="mi-salon-app">
      {toastMessage && (
        <div className={`toast-notice ${toastMessage.type === 'error' ? 'error' : toastMessage.type === 'info' ? 'info' : 'success'}`}>
          {toastMessage.type === 'error' ? <XCircle size={18} /> : toastMessage.type === 'info' ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">MS</div>
          <div>
            <h1>Your Agenda</h1>
            <p>Nail Art &amp; Care ♡</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <button className={`nav-button ${activeView === 'inicio' ? 'active' : ''}`} onClick={() => setActiveView('inicio')}>
            <Home size={18} />
            Inicio
          </button>
          <button className={`nav-button ${activeView === 'citas' ? 'active' : ''}`} onClick={() => setActiveView('citas')}>
            <Calendar size={18} />
            Citas
          </button>
          <button className={`nav-button ${activeView === 'horarios' ? 'active' : ''}`} onClick={() => setActiveView('horarios')}>
            <Clock size={18} />
            Horarios
          </button>
        </nav>

        <button className="logout-button" onClick={() => showToast('Sesión cerrada', 'info')}>
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      <main className="main-panel">
        {activeView === 'inicio' ? (
          <section className="home-view">
            <button className="income-day-card" onClick={() => setShowIncomeHistoryModal(true)}>
              <div className="income-day-icon">
                <DollarSign size={24} />
              </div>
              <div className="income-day-copy">
                <span>Ingresos del Día</span>
                <strong>{formatMoney(todayMetrics.earnedRevenue)}</strong>
              </div>
            </button>

            <div className="home-layout">
              <div className="home-calendar-panel spa-card">
                <div className="calendar-header-banner">
                  <div>
                    <h2 className="calendar-title">
                      <Calendar size={22} color="#D47A83" />
                      Calendario
                    </h2>
                  </div>

                  <div className="calendar-top-controls compact-top-controls">
                    <div className="month-nav-group">
                      <button className="btn-month-nav" onClick={handlePrevMonth} title="Mes anterior">
                        <ChevronLeft size={18} />
                      </button>
                      <span className="month-display-title">
                        {calendarMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </span>
                      <button className="btn-month-nav" onClick={handleNextMonth} title="Mes siguiente">
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <button className="btn-today-chip" onClick={handleGoToToday} title="Ir a hoy">
                      Hoy
                    </button>
                  </div>
                </div>

                <div className="calendar-grid-wrapper">
                  <div className="calendar-weekdays-row">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(wd => (
                      <div key={wd} className="weekday-header-cell">{wd}</div>
                    ))}
                  </div>

                  <div className="calendar-days-grid">
                    {calendarDays.map((day) => {
                      const hasCitas = (appointmentsByDate[day.dateStr] || []).length > 0
                      const isSelected = day.dateStr === selectedDate
                      const isToday = day.dateStr === todayString

                      return (
                        <div
                          key={day.dateStr}
                          className={`calendar-day-tile ${day.isCurrentMonth ? '' : 'other-month'} ${hasCitas ? 'busy' : 'available'} ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                          onClick={() => setSelectedDate(day.dateStr)}
                          title={`${day.dateStr}: ${hasCitas ? 'Citas programadas' : 'Día libre'}`}
                        >
                          <div className="tile-top-row">
                            <span className="day-number-label">{day.dayNumber}</span>
                            {isToday && <span className="badge-today-mini">HOY</span>}
                          </div>

                          <div className="tile-content-indicator">
                            {hasCitas ? (
                              <span className="availability-pill busy">
                                <span className="legend-dot busy" style={{ width: '7px', height: '7px' }}></span>
                                <span>{(appointmentsByDate[day.dateStr] || []).length}</span>
                              </span>
                            ) : (
                              <span className="availability-pill available">
                                <span className="legend-dot available" style={{ width: '7px', height: '7px' }}></span>
                                <span>Libre</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="home-day-panel spa-card">
                <div className="home-day-header">
                  <div>
                    <span className="table-eyebrow">Agenda</span>
                    <h3>{formatHumanDate(selectedDate) || 'Hoy'}</h3>
                  </div>
                  <button className="primary-button small-button" onClick={() => handleOpenNewAppointmentModal(selectedDate)}>
                    <PlusCircle size={16} />
                    Agendar
                  </button>
                </div>

                <div className="home-citas-list">
                  {selectedDateCitas.length === 0 ? (
                    <div className="home-empty-state">
                      <CalendarDays size={18} />
                      <p>No hay citas para esta fecha.</p>
                    </div>
                  ) : selectedDateCitas.map(cita => (
                    <div key={cita.id} className="home-cita-item">
                      <div className="home-cita-main">
                        <strong>{cita.nombre_cliente || cita.cliente || 'Clienta'}</strong>
                        <span>{cita.servicio}</span>
                      </div>

                      <div className="home-cita-meta">
                        <span>{formatTime12Hour(cita.hora)}</span>
                        <span>{formatMoney(cita.precio)}</span>
                      </div>

                      <span className={`status-badge ${isCitaCompleted(cita) ? 'confirmed' : isCitaPending(cita) ? 'pending' : 'cancelled'}`}>
                        {getEstadoLabel(cita.estado)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : activeView === 'citas' ? (
          <>
            <header className="content-header">
              <div className="header-title-wrap">
                <div className="header-title-icon">
                  <Calendar size={22} />
                </div>
                <div>
                  <h2>Citas</h2>
                  <p>Gestiona todas tus citas y mantén tu agenda organizada</p>
                </div>
              </div>

              <button className="primary-button" onClick={() => handleOpenNewAppointmentModal(selectedDate)}>
                <PlusCircle size={18} />
                Agendar cita
              </button>
            </header>

            <section className="filters-card" aria-label="Filtros de citas">
              <div className="filter-row">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Buscar clienta, servicio o fecha"
                  />
                </label>

                <label className="select-field">
                  <Filter size={16} />
                  <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}>
                    {uniqueServices.map(service => (
                      <option key={service} value={service}>{service === 'Todos' ? 'Todas las categorías' : service}</option>
                    ))}
                  </select>
                </label>

                <label className="select-field small-field">
                  <BriefcaseBusiness size={16} />
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}>
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>

                <label className="date-field">
                  <Calendar size={16} />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="table-card">
              <div className="table-headline">
                <div>
                  <span className="table-eyebrow">Agenda</span>
                  <h3>{filteredCitas.length} citas registradas</h3>
                </div>
                <div className="mini-stats">
                  <span>{todayMetrics.totalCount} hoy</span>
                  <span>{formatMoney(todayMetrics.earnedRevenue)} cobrados</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Cliente</th>
                      <th>Servicio</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCitas.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="empty-row">No se encontraron citas con estos filtros.</td>
                      </tr>
                    ) : currentCitas.map(cita => {
                      const estado = String(cita.estado || '').toLowerCase()
                      const isConfirmed = estado === 'completada' || estado === 'confirmada'
                      const isPending = estado === 'pendiente'

                      return (
                        <tr key={cita.id}>
                          <td>{formatHumanDate(cita.fecha)}</td>
                          <td>{formatTime12Hour(cita.hora)}</td>
                          <td>
                            <div className="client-cell">
                              <span className="avatar-pill">{(cita.nombre_cliente || cita.cliente || 'C').charAt(0).toUpperCase()}</span>
                              <span>{cita.nombre_cliente || cita.cliente || 'Clienta'}</span>
                            </div>
                          </td>
                          <td>{cita.servicio}</td>
                          <td>{formatMoney(cita.precio)}</td>
                          <td>
                            <span className={`status-badge ${isConfirmed ? 'confirmed' : isPending ? 'pending' : 'cancelled'}`}>
                              {getEstadoLabel(cita.estado)}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="icon-button edit" onClick={() => handleOpenEditAppointmentModal(cita)} title="Editar cita">
                                <Pencil size={15} />
                              </button>
                              <button className="icon-button delete" onClick={() => handleDeleteCita(cita.id)} title="Eliminar cita">
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

              <div className="pagination">
                <button className="page-arrow" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={16} />
                </button>
                <button className="page-number active">{currentPage}</button>
                <button className="page-arrow" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
          </>
        ) : activeView === 'horarios' ? (
          <section className="schedule-view">
            <header className="content-header schedule-heading">
              <div className="header-title-wrap">
                <div className="header-title-icon">
                  <Clock size={22} />
                </div>
                <div>
                  <h2>Horarios</h2>
                  <p>Consulta las citas programadas por día y cliente</p>
                </div>
              </div>
            </header>

            <section className="schedule-card">
              <div className="schedule-table-wrapper">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Día y rango de trabajo</th>
                      <th>Citas programadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklySchedule.map(({ day, hours, appointments }) => (
                      <tr key={day}>
                        <td className="schedule-day-cell">
                          <strong>{day}</strong>
                          {hours ? <span>{hours}</span> : <span className="closed-label">CERRADO</span>}
                        </td>
                        <td className="schedule-appointments-cell">
                          {hours && (appointments.length === 0 ? (
                            <span className="no-scheduled-appointments">Sin citas programadas</span>
                          ) : (
                            <div className="scheduled-appointment-list">
                              {appointments.map(cita => (
                                <div className="scheduled-appointment" key={cita.id}>
                                  <span className="scheduled-time">{formatTime12Hour(cita.hora)}</span>
                                  <span className="scheduled-client">
                                    {cita.nombre_cliente || cita.cliente || 'Clienta'}
                                    <span>({cita.servicio || 'Servicio'})</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : (
          <section className="placeholder-panel">
            <div className="placeholder-box">
              <div className="placeholder-icon">
                <Users size={24} />
              </div>
              <h3>Clientas</h3>
              <p>Esta vista aún no está habilitada, pero la sección de citas queda activa por defecto y lista para gestionar la agenda.</p>
            </div>
          </section>
        )}
      </main>

      {showQuickBookModal && (
        <div className="modal-overlay" onClick={() => setShowQuickBookModal(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Sparkles size={20} />
                <h3>{editingCitaId !== null ? 'Editar cita' : 'Agendar nueva cita'}</h3>
              </div>
              <button className="icon-button close" onClick={() => { setShowQuickBookModal(false); setEditingCitaId(null) }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="selected-date-badge">
                <CalendarDays size={15} />
                <span>Fecha seleccionada: <strong>{formatHumanDate(formData.fecha)}</strong></span>
              </div>

              <form onSubmit={handleSubmitCita} className="booking-form">
                <label className="form-field">
                  <span>Nombre de la clienta</span>
                  <div className="input-with-icon">
                    <User size={16} />
                    <input type="text" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} placeholder="Ej. Ana Sofía" required />
                  </div>
                </label>

                <div className="form-group">
                  <label className="form-field">
                    <span>Servicio</span>
                    <div className="service-chip-list">
                      {PRESET_SERVICES.map(serv => (
                        <button
                          type="button"
                          key={serv.name}
                          className={`service-chip ${formData.servicio === serv.name ? 'selected' : ''}`}
                          onClick={() => setFormData({ ...formData, servicio: serv.name, precio: String(serv.price) })}
                        >
                          {serv.name}
                        </button>
                      ))}
                    </div>
                    <div className="input-with-icon mt-8">
                      <Sparkles size={16} />
                      <input type="text" value={formData.servicio} onChange={e => setFormData({ ...formData, servicio: e.target.value })} required />
                    </div>
                  </label>
                </div>

                <div className="two-columns">
                  <label className="form-field">
                    <span>Fecha</span>
                    <div className="input-with-icon">
                      <Calendar size={16} />
                      <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} required />
                    </div>
                  </label>

                  <label className="form-field">
                    <span>Hora</span>
                    <div className="input-with-icon">
                      <Clock size={16} />
                      <input type="time" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} required />
                    </div>
                  </label>
                </div>

                <div className="two-columns">
                  <label className="form-field">
                    <span>Precio</span>
                    <div className="input-with-icon">
                      <DollarSign size={16} />
                      <input type="number" min="0" step="10" value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value })} required />
                    </div>
                  </label>

                  <label className="form-field">
                    <span>Estado</span>
                    <div className="status-selector">
                      <button type="button" className={`status-option ${formData.estado === 'pendiente' ? 'selected pending' : ''}`} onClick={() => setFormData({ ...formData, estado: 'pendiente' })}>
                        <Clock3 size={14} />
                        Pendiente
                      </button>
                      <button type="button" className={`status-option ${formData.estado === 'completada' ? 'selected confirm' : ''}`} onClick={() => setFormData({ ...formData, estado: 'completada' })}>
                        <CheckCircle2 size={14} />
                        Confirmada
                      </button>
                    </div>
                  </label>
                </div>

                <button type="submit" className="submit-button" disabled={isSubmitting}>
                  <Heart size={18} />
                  {isSubmitting ? 'Guardando…' : editingCitaId !== null ? 'Guardar cambios' : 'Confirmar y agendar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showIncomeHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowIncomeHistoryModal(false)}>
          <div className="modal-dialog income-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Receipt size={20} />
                <h3>Historial de ingresos</h3>
              </div>
              <button className="icon-button close" onClick={() => setShowIncomeHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="income-summary">
                <div>
                  <span>Ingresos del día</span>
                  <strong>{formatMoney(todayMetrics.earnedRevenue)}</strong>
                </div>
                <div>
                  <span>Ingresos del mes</span>
                  <strong>{formatMoney(monthlyMetrics.earnedRevenue)}</strong>
                </div>
              </div>

              <div className="income-list">
                {incomeTransactions.length === 0 ? (
                  <div className="empty-income-state">
                    <Receipt size={20} />
                    <p>Aún no hay ingresos registrados este mes.</p>
                  </div>
                ) : incomeTransactions.map(transaction => (
                  <div className="income-item" key={transaction.id}>
                    <div className="income-icon">
                      <ArrowDownLeft size={15} />
                    </div>
                    <div className="income-copy">
                      <strong>{transaction.nombre_cliente || transaction.cliente || 'Clienta'}</strong>
                      <span>{transaction.servicio}</span>
                    </div>
                    <div className="income-meta">
                      <span>{formatHumanDate(transaction.fecha)}</span>
                      <span>{formatTime12Hour(transaction.hora)}</span>
                    </div>
                    <strong className="income-amount">+{formatMoney(transaction.precio)}</strong>
                  </div>
                ))}
              </div>

              <button className="secondary-button" onClick={() => setShowIncomeHistoryModal(false)}>
                Cerrar historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
