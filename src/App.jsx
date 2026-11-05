import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, AudioLines, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, HeartPulse, Languages,
  MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Stethoscope, UserRound,
  X,
} from 'lucide-react'
import './App.css'

const iconMap = { Dermatology: Activity, Dentistry: HeartPulse, ENT: Activity, 'General medicine': Stethoscope }
const quickPrompts = ['I have ear pain', 'Find a dentist tomorrow', 'Skin doctor near Indiranagar']

function dayLabel(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' }).format(date)
}

function nextDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return { key: date.toISOString().slice(0, 10), label: index === 0 ? 'Today' : dayLabel(date), sub: index === 0 ? dayLabel(date) : '' }
  })
}

function App() {
  const [clinics, setClinics] = useState([])
  const [appointments, setAppointments] = useState([])
  const [activeView, setActiveView] = useState('discover')
  const [selectedDay, setSelectedDay] = useState(nextDays()[0].key)
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('Indiranagar')
  const [service, setService] = useState('All services')
  const [assistantText, setAssistantText] = useState('')
  const [assistantResult, setAssistantResult] = useState(null)
  const [isThinking, setIsThinking] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [bookingClinic, setBookingClinic] = useState(null)
  const [bookingSlot, setBookingSlot] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [bookingState, setBookingState] = useState('idle')
  const [toast, setToast] = useState('')
  const days = useMemo(() => nextDays(), [])

  useEffect(() => {
    let current = true
    async function load() {
      const params = new URLSearchParams()
      if (query) params.set('search', query)
      if (area) params.set('area', area)
      if (service !== 'All services') params.set('service', service)
      params.set('date', selectedDay)
      try {
        const response = await fetch(`/api/clinics?${params}`)
        if (!response.ok) throw new Error('Could not load clinics')
        const data = await response.json()
        if (current) setClinics(data.clinics)
      } catch {
        if (current) {
          setClinics([])
          setToast('The clinic service is unavailable. Start the API server and retry.')
        }
      }
    }
    void load()
    return () => { current = false }
  }, [query, area, service, selectedDay, refreshKey])

  useEffect(() => {
    let current = true
    async function load() {
      try {
        const response = await fetch('/api/appointments')
        const data = await response.json()
        if (current) setAppointments(data.appointments || [])
      } catch {
        if (current) setAppointments([])
      }
    }
    void load()
    return () => { current = false }
  }, [activeView, refreshKey])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function askAssistant(prompt = assistantText) {
    const clean = prompt.trim()
    if (!clean) return
    setAssistantText(clean)
    setAssistantResult(null)
    setIsThinking(true)
    try {
      const response = await fetch('/api/assistant/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, language: 'en' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Assistant is unavailable')
      setAssistantResult(data)
      if (data.suggestedService) setService(data.suggestedService)
      if (data.area) setArea(data.area)
    } catch {
      setAssistantResult({ message: 'I could not understand that just now. Try a clinic service name, or use the search filters.', source: 'fallback' })
    } finally {
      setIsThinking(false)
    }
  }

  function openBooking(clinic, slot) {
    setBookingClinic(clinic)
    setBookingSlot(slot)
    setBookingState('idle')
  }

  async function submitBooking(event) {
    event.preventDefault()
    if (!bookingClinic || !bookingSlot) return
    setBookingState('saving')
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: bookingClinic.id, service: service === 'All services' ? bookingClinic.services[0] : service,
          date: selectedDay, time: bookingSlot, patientName: patientName.trim(), phone: patientPhone.trim(),
        }),
      })
      const result = await response.json()
      if (response.status === 409) {
        setBookingState('conflict')
        setRefreshKey((value) => value + 1)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Could not submit booking')
      setBookingState('done')
      setRefreshKey((value) => value + 1)
    } catch {
      setBookingState('error')
    }
  }

  async function updateAppointment(id, status) {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Update failed')
      setRefreshKey((value) => value + 1)
      setToast(`Appointment marked ${status.toLowerCase()}.`)
    } catch {
      setToast('Could not update this appointment. Please retry.')
    }
  }

  const navigation = [
    { id: 'discover', label: 'Find a clinic', icon: Search },
    { id: 'appointments', label: 'My appointments', icon: CalendarDays },
    { id: 'clinic', label: 'Clinic portal', icon: Stethoscope },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="ClinicConnect home">
          <span className="brand-mark"><HeartPulse size={21} strokeWidth={2.4} /></span>
          <span>clinic<span className="brand-light">connect</span><span className="brand-ai"> AI</span></span>
        </a>
        <div className="side-caption">YOUR CARE, CONNECTED</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? 'active' : ''}`} onClick={() => setActiveView(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === 'appointments' && appointments.length > 0 && <span className="nav-count">{appointments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="side-help">
          <div className="help-icon"><MessageCircle size={17} /></div>
          <p>Need a hand?</p>
          <span>Our team is happy to help you book.</span>
          <button onClick={() => setToast('Support contact will be added during setup.')}>Get support <ArrowRight size={14} /></button>
        </div>
        <div className="profile-mini">
          <div className="avatar">SS</div><div className="profile-copy"><strong>Student preview</strong><span>Demo workspace</span></div>
          <ChevronDown size={16} className="profile-chevron" />
        </div>
      </aside>

      <main className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumb">Patient workspace <span>/</span> <strong>{navigation.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="top-actions">
            <span className="demo-pill"><span /> DEMO DATA</span>
            <button className="language-button" onClick={() => setToast('English is enabled. The pilot language will be selected during setup.')}><Languages size={16} /> English <ChevronDown size={14} /></button>
            <button className="top-avatar" aria-label="User profile">SS</button>
          </div>
        </header>

        {activeView === 'discover' && (
          <div className="page-content">
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> A CALMER WAY TO FIND CARE</div>
                <h1>Good morning, Sakshi <span className="wave">✦</span></h1>
                <p className="welcome-sub">Tell us what you need. We’ll help you find a clinic and a time that works.</p>
              </div>
              <div className="care-note"><ShieldCheck size={17} /><span>Sample clinic directory</span></div>
            </section>

            <section className="search-panel" aria-label="Clinic search">
              <label className="search-input-wrap"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a clinic, service, or concern" /></label>
              <span className="search-divider" />
              <label className="search-select"><MapPin size={18} /><select value={area} onChange={(event) => setArea(event.target.value)}><option>Indiranagar</option><option>Koramangala</option><option>Whitefield</option><option>Any area</option></select><ChevronDown size={14} /></label>
              <button className="search-submit" onClick={() => setRefreshKey((value) => value + 1)}>Search clinics <ArrowRight size={16} /></button>
            </section>

            <div className="content-grid">
              <section className="results-column">
                <div className="section-head">
                  <div><h2>Clinics around you</h2><p>Sample profiles · availability shown for your selected day</p></div>
                  <label className="service-filter"><span className="sr-only">Filter by service</span><select value={service} onChange={(event) => setService(event.target.value)}><option>All services</option><option>Dentistry</option><option>ENT</option><option>Dermatology</option><option>General medicine</option></select><ChevronDown size={14} /></label>
                </div>
                <div className="date-strip" aria-label="Choose appointment day">
                  <button className="date-arrow" aria-label="Previous dates" onClick={() => setSelectedDay(days[0].key)}><ChevronLeft size={17} /></button>
                  {days.slice(0, 5).map((day) => <button key={day.key} className={`date-chip ${selectedDay === day.key ? 'selected' : ''}`} onClick={() => setSelectedDay(day.key)}><strong>{day.label}</strong>{day.sub && <span>{day.sub}</span>}</button>)}
                  <button className="date-arrow" aria-label="More dates" onClick={() => setSelectedDay(days[6].key)}><ChevronRight size={17} /></button>
                </div>

                <div className="clinic-list">
                  {clinics.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} onBook={openBooking} />)}
                  {clinics.length === 0 && <div className="empty-state"><Search size={22} /><strong>No matching clinics yet</strong><span>Try another service or nearby area. This demo includes sample profiles.</span></div>}
                </div>
                <div className="safety-note"><ShieldCheck size={16} /><span>ClinicConnect helps with appointment booking. It does not diagnose or provide treatment advice.</span></div>
              </section>

              <aside className="assistant-column">
                <div className="assistant-card">
                  <div className="assistant-head"><div className="assistant-icon"><Sparkles size={19} /></div><div><h2>Booking assistant</h2><span><i /> Ready to help</span></div><button className="more-button" aria-label="Assistant options">•••</button></div>
                  <div className="assistant-rule" />
                  <div className="bot-message"><div className="bot-avatar"><Sparkles size={14} /></div><div><span className="message-time">JUST NOW</span><p>Hi Sakshi! Tell me what you’re looking for in your own words. You can describe a concern, service, or preferred time.</p></div></div>
                  {assistantResult && <div className="assistant-response"><span className="response-label">{assistantResult.source === 'demo-rules' ? 'BOOKING SUGGESTION' : 'ASSISTANT'}</span><p>{assistantResult.message}</p>{assistantResult.suggestedService && <div className="suggested-service"><Stethoscope size={15} /><span>Suggested service</span><strong>{assistantResult.suggestedService}</strong><button onClick={() => { setService(assistantResult.suggestedService); setAssistantResult({ ...assistantResult, message: `Showing clinic profiles that list ${assistantResult.suggestedService}. Please confirm this service matches what you want to book.` }) }}>Use this</button></div>}</div>}
                  <div className="prompt-label">TRY ASKING</div>
                  <div className="quick-prompts">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => askAssistant(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div>
                  <div className="assistant-compose"><textarea value={assistantText} onChange={(event) => setAssistantText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); askAssistant() } }} placeholder="Describe what you’re looking for…" rows={2} aria-label="Describe what you need" /><div className="compose-actions"><span><AudioLines size={15} /> Voice notes on WhatsApp are planned</span><button disabled={isThinking || !assistantText.trim()} onClick={() => askAssistant()} aria-label="Send message">{isThinking ? <span className="spinner" /> : <ArrowRight size={17} />}</button></div></div>
                  <div className="assistant-disclaimer">Demo matching uses service keywords. No AI provider is connected yet.</div>
                </div>
                <div className="whatsapp-card"><div className="whatsapp-badge"><MessageCircle size={18} /></div><div><strong>Prefer to talk?</strong><span>WhatsApp voice booking is on our roadmap.</span></div><ArrowRight size={16} /></div>
              </aside>
            </div>
          </div>
        )}

        {activeView === 'appointments' && <AppointmentsPage appointments={appointments} onBrowse={() => setActiveView('discover')} />}
        {activeView === 'clinic' && <ClinicPage appointments={appointments} onUpdate={updateAppointment} />}
      </main>

      {bookingClinic && <BookingModal clinic={bookingClinic} slot={bookingSlot} day={selectedDay} name={patientName} phone={patientPhone} setName={setPatientName} setPhone={setPatientPhone} state={bookingState} onSubmit={submitBooking} onClose={() => { setBookingClinic(null); setBookingState('idle') }} onRetry={() => setBookingState('idle')} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  )
}

function ClinicCard({ clinic, onBook }) {
  const Icon = iconMap[clinic.services[0]] || Stethoscope
  return (
    <article className="clinic-card">
      <div className={`clinic-art art-${clinic.accent}`}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="clinic-art-icon"><Icon size={27} /></div><span className="art-label">{clinic.artLabel}</span></div>
      <div className="clinic-details">
        <div className="clinic-title-row"><div><div className="clinic-tags"><span className="verified"><ShieldCheck size={12} /> SAMPLE PROFILE</span>{clinic.languages?.map((language) => <span key={language} className="language-tag">{language}</span>)}</div><h3>{clinic.name}</h3><p className="clinic-location"><MapPin size={14} /> {clinic.area} <span>·</span> {clinic.address}</p></div><button className="favorite-button" aria-label={`Save ${clinic.name}`} onClick={(event) => event.currentTarget.classList.toggle('saved')}>♡</button></div>
        <p className="clinic-description">{clinic.description}</p>
        <div className="clinic-meta"><span><Clock3 size={14} /> {clinic.openingLabel}</span><span className="service-label"><Stethoscope size={14} /> {clinic.services.join(' · ')}</span></div>
        <div className="slot-row"><strong>Available times</strong><div className="slot-list">{clinic.slots.length ? clinic.slots.slice(0, 3).map((slot) => <button key={slot.time} onClick={() => onBook(clinic, slot.time)}>{slot.time}</button>) : <span className="no-slots">No slots on this day</span>}</div></div>
        <button className="view-clinic" onClick={() => clinic.slots[0] && onBook(clinic, clinic.slots[0].time)}>Book first available <ArrowRight size={15} /></button>
      </div>
    </article>
  )
}

function BookingModal({ clinic, slot, day, name, phone, setName, setPhone, state, onSubmit, onClose, onRetry }) {
  const date = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day}T12:00:00`))
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-top"><span className="modal-kicker"><CalendarDays size={15} /> APPOINTMENT REQUEST</span><button className="close-modal" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        {state === 'done' ? <div className="booking-success"><div className="success-mark"><Check size={28} /></div><div className="eyebrow">REQUEST SUBMITTED</div><h2 id="booking-title">You’re on your way.</h2><p>Your appointment request for <strong>{clinic.name}</strong> is in the clinic demo queue.</p><div className="booking-summary"><span>{date}</span><strong>{slot}</strong></div><p className="pending-note">Status: Pending clinic confirmation. This is sample data and no real clinic was contacted.</p><button className="primary-button full-button" onClick={onClose}>Done <ArrowRight size={16} /></button></div> : <>
          <h2 id="booking-title">Request this appointment</h2><p className="modal-intro">We’ll share only the details needed for this sample booking.</p>
          <div className="selected-clinic"><div className={`small-clinic-icon art-${clinic.accent}`}><Stethoscope size={18} /></div><div><strong>{clinic.name}</strong><span>{date} · {slot}</span></div></div>
          {state === 'conflict' && <div className="form-alert">That sample slot was just taken. Choose another available time.</div>}
          {state === 'error' && <div className="form-alert">We couldn’t submit the request. Please retry.</div>}
          <form onSubmit={onSubmit} className="booking-form"><label>Your name<input required maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" autoComplete="name" /></label><label>Phone number for this demo<input required maxLength="20" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 98765 43210" autoComplete="tel" /></label><div className="privacy-hint"><ShieldCheck size={15} /> Use sample details only. Do not enter real health information.</div><button className="primary-button full-button" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Submitting…' : 'Submit booking request'} <ArrowRight size={16} /></button></form>
          <button className="text-button" onClick={state === 'conflict' ? onRetry : onClose}>{state === 'conflict' ? 'Choose a different time' : 'Cancel'}</button>
        </>}
      </section>
    </div>
  )
}

function AppointmentsPage({ appointments, onBrowse }) {
  return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> YOUR SCHEDULE</div><h1>My appointments</h1><p className="welcome-sub">Track requests and see updates from clinics.</p><div className="secondary-panel"><div className="panel-heading"><div><h2>Appointment requests</h2><p>Sample data stored in this demo session.</p></div><CalendarDays size={21} /></div>{appointments.length ? appointments.map((appointment) => <div className="appointment-row" key={appointment.id}><div className="appointment-date"><strong>{appointment.dateLabel}</strong><span>{appointment.time}</span></div><div className="appointment-info"><strong>{appointment.clinicName}</strong><span>{appointment.service} · {appointment.patientName}</span></div><span className={`status-chip status-${appointment.status.toLowerCase()}`}>{appointment.status}</span></div>) : <div className="empty-state large-empty"><CalendarDays size={24} /><strong>No appointments yet</strong><span>When you submit a booking request, it will appear here.</span><button className="primary-button" onClick={onBrowse}>Find a clinic <ArrowRight size={15} /></button></div>}</div></div>
}

function ClinicPage({ appointments, onUpdate }) {
  const requests = appointments.filter((appointment) => appointment.status === 'Pending')
  return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> CLINIC WORKSPACE</div><h1>Clinic portal</h1><p className="welcome-sub">Review sample booking requests and update their status.</p><div className="clinic-dashboard-banner"><div className="dashboard-icon"><Stethoscope size={21} /></div><div><strong>Sample Clinic Workspace</strong><span>Demo data · schedule editing will be added in the next milestone</span></div><span className="dashboard-state"><i /> DEMO</span></div><div className="secondary-panel"><div className="panel-heading"><div><h2>Incoming requests</h2><p>{requests.length} pending request{requests.length === 1 ? '' : 's'}</p></div><ArrowDownLeft size={21} /></div>{appointments.length ? appointments.map((appointment) => <div className="clinic-request-row" key={appointment.id}><div className="patient-avatar"><UserRound size={17} /></div><div className="request-main"><strong>{appointment.patientName}</strong><span>{appointment.service} · {appointment.dateLabel} at {appointment.time}</span></div><span className={`status-chip status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>{appointment.status === 'Pending' && <div className="request-actions"><button className="decline-button" onClick={() => onUpdate(appointment.id, 'Declined')}>Decline</button><button className="confirm-button" onClick={() => onUpdate(appointment.id, 'Confirmed')}><Check size={14} /> Confirm</button></div>}</div>) : <div className="empty-state large-empty"><CalendarDays size={24} /><strong>No booking requests</strong><span>New sample patient requests will show here.</span></div>}</div></div>
}

export default App
