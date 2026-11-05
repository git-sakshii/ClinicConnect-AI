import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, AudioLines, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, HeartPulse, Languages,
  MapPin, MessageCircle, Mic, Search, ShieldCheck, Sparkles, Stethoscope, UserRound,
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
  const [account, setAccount] = useState(null)
  const [activeView, setActiveView] = useState('discover')
  const [selectedDay, setSelectedDay] = useState(nextDays()[0].key)
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('Indiranagar')
  const [directorySource, setDirectorySource] = useState('osm')
  const [liveSearch, setLiveSearch] = useState(null)
  const [savedClinics, setSavedClinics] = useState(() => new Set(JSON.parse(localStorage.getItem('clinicconnect:saved') || '[]')))
  const [directoryError, setDirectoryError] = useState('')
  const [service, setService] = useState('All services')
  const [assistantText, setAssistantText] = useState('')
  const [language, setLanguage] = useState('en')
  const [isListening, setIsListening] = useState(false)
  const [assistantResult, setAssistantResult] = useState(null)
  const [isThinking, setIsThinking] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [bookingClinic, setBookingClinic] = useState(null)
  const [bookingSlot, setBookingSlot] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [bookingState, setBookingState] = useState('idle')
  const [toast, setToast] = useState('')
  const days = useMemo(() => nextDays(), [])
  const displayedClinics = useMemo(() => {
    if (directorySource !== 'osm' || !query.trim()) return clinics
    const term = query.trim().toLowerCase()
    return clinics.filter((clinic) => `${clinic.name} ${clinic.area} ${clinic.address} ${clinic.services.join(' ')}`.toLowerCase().includes(term))
  }, [clinics, directorySource, query])

  useEffect(() => {
    fetch('/api/auth/me').then((response) => response.json()).then((data) => setAccount(data.user || null)).catch(() => setAccount(null))
    fetch('/api/assistant/status').then((response) => response.json()).then((data) => setAiEnabled(Boolean(data.aiEnabled))).catch(() => setAiEnabled(false))
  }, [])

  useEffect(() => {
    if (directorySource === 'osm') return undefined
    let current = true
    async function load() {
      const params = new URLSearchParams()
      if (query) params.set('search', query)
      if (area) params.set('area', area)
      if (service !== 'All services') params.set('service', service)
      params.set('source', directorySource)
      params.set('date', selectedDay)
      try {
        const response = await fetch(`/api/clinics?${params}`)
        if (!response.ok) throw new Error('Could not load clinics')
        const data = await response.json()
        if (current) { setClinics(data.clinics); setDirectoryError('') }
      } catch {
        if (current) {
          setClinics([])
          setDirectoryError(directorySource === 'osm' ? 'The live OpenStreetMap lookup is temporarily unavailable. Retry in a moment or switch to sample listings.' : 'The clinic service is unavailable. Start the API server and retry.')
        }
      }
    }
    void load()
    return () => { current = false }
  }, [query, area, service, selectedDay, refreshKey, directorySource])

  useEffect(() => {
    if (directorySource !== 'osm' || !liveSearch) return undefined
    let current = true
    async function load() {
      const params = new URLSearchParams({ source: 'osm', area: liveSearch.area, search: liveSearch.query })
      if (liveSearch.service !== 'All services') params.set('service', liveSearch.service)
      try {
        const response = await fetch(`/api/clinics?${params}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Live listings could not be loaded')
        if (current) { setClinics(data.clinics); setDirectoryError('') }
      } catch {
        if (current) { setClinics([]); setDirectoryError('The live OpenStreetMap lookup is temporarily unavailable. Retry in a moment or switch to sample listings.') }
      }
    }
    void load()
    return () => { current = false }
  }, [directorySource, liveSearch])

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
  }, [activeView, refreshKey, account?.role])
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
        body: JSON.stringify({ message: clean, language, allowAi: aiEnabled && aiConsent }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Assistant is unavailable')
      setAssistantResult(data)
      if (data.area) setArea(data.area)
    } catch {
      setAssistantResult({ message: 'I could not understand that just now. Try a clinic service name, or use the search filters.', source: 'fallback' })
    } finally {
      setIsThinking(false)
    }
  }

  function listenForRequest() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setToast('Voice input is not available in this browser. Try Chrome or type your request.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = language === 'kn' ? 'kn-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event) => setAssistantText(event.results[0][0].transcript)
    recognition.onerror = () => { setIsListening(false); setToast('Voice input could not start. Check browser microphone permission or type your request.') }
    recognition.onend = () => setIsListening(false)
    recognition.start()
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
            <span className={`demo-pill ${directorySource !== 'demo' ? 'live-pill' : ''}`}><span /> {directorySource === 'osm' ? 'OPENSTREETMAP' : directorySource === 'partners' ? 'PARTNER CLINICS' : 'SAMPLE DATA'}</span>
            <button className="language-button" onClick={() => setLanguage((current) => current === 'en' ? 'kn' : 'en')} aria-label="Switch voice language"><Languages size={16} /> {language === 'en' ? 'English' : 'ಕನ್ನಡ'} <ChevronDown size={14} /></button>
            <button className="top-avatar" aria-label="Open account and clinic portal" title={account?.email || 'Sign in'} onClick={() => setActiveView('clinic')}>{account?.email?.slice(0, 2).toUpperCase() || 'SS'}</button>
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
                <div className="care-note"><ShieldCheck size={17} /><span>{directorySource === 'osm' ? 'Live public directory' : directorySource === 'partners' ? 'Approved ClinicConnect partners' : 'Sample directory'}</span></div>
            </section>

            <section className="search-panel" aria-label="Clinic search">
              <label className="search-input-wrap"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={directorySource === 'osm' ? 'Filter by clinic name' : 'Search a clinic, service, or concern'} /></label>
              <span className="search-divider" />
              <label className="search-select"><MapPin size={18} /><select value={area} onChange={(event) => setArea(event.target.value)}><option>Indiranagar</option><option>Koramangala</option><option>Whitefield</option><option>Any area</option></select><ChevronDown size={14} /></label>
              <button className="search-submit" onClick={() => directorySource === 'osm' ? setLiveSearch({ query, area, service, requestedAt: Date.now() }) : setRefreshKey((value) => value + 1)}>Search clinics <ArrowRight size={16} /></button>
            </section>

            <div className="content-grid">
              <section className="results-column">
                <div className="section-head">
                  <div><h2>Clinics around you</h2><p>{directorySource === 'osm' ? 'OpenStreetMap listings · contact clinics to confirm details and appointments' : directorySource === 'partners' ? 'Approved clinics · times entered by clinic operators' : 'Sample profiles · availability shown for your selected day'}</p></div>
                  <label className="service-filter"><span className="sr-only">Filter by service</span><select value={service} onChange={(event) => setService(event.target.value)}><option>All services</option><option>Dentistry</option><option>ENT</option><option>Dermatology</option><option>General medicine</option><option>Clinic</option></select><ChevronDown size={14} /></label>
                </div>
                <div className="directory-toolbar">
                  <label>Directory <select value={directorySource} onChange={(event) => { setDirectorySource(event.target.value); setClinics([]); setDirectoryError(''); setLiveSearch(null) }}><option value="osm">Live OpenStreetMap data</option><option value="partners">Approved ClinicConnect partners</option><option value="demo">Sample prototype data</option></select></label>
                  <span>{savedClinics.size} saved</span>
                </div>
                {directoryError && <div className="directory-alert" role="status">{directoryError}</div>}
                {directorySource !== 'osm' && <div className="date-strip" aria-label="Choose appointment day">
                  <button className="date-arrow" aria-label="Previous dates" onClick={() => setSelectedDay(days[0].key)}><ChevronLeft size={17} /></button>
                  {days.slice(0, 5).map((day) => <button key={day.key} className={`date-chip ${selectedDay === day.key ? 'selected' : ''}`} onClick={() => setSelectedDay(day.key)}><strong>{day.label}</strong>{day.sub && <span>{day.sub}</span>}</button>)}
                  <button className="date-arrow" aria-label="More dates" onClick={() => setSelectedDay(days[6].key)}><ChevronRight size={17} /></button>
                </div>}

                <div className="clinic-list">
                  {displayedClinics.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} onBook={openBooking} saved={savedClinics.has(clinic.id)} onSave={() => setSavedClinics((current) => { const next = new Set(current); if (next.has(clinic.id)) { next.delete(clinic.id) } else { next.add(clinic.id) } localStorage.setItem('clinicconnect:saved', JSON.stringify([...next])); return next })} />)}
                  {displayedClinics.length === 0 && <div className="empty-state"><Search size={22} /><strong>{directoryError ? 'Live listings could not be loaded' : directorySource === 'osm' && !liveSearch ? 'Search OpenStreetMap listings' : 'No matching clinics yet'}</strong><span>{directoryError ? directoryError : 'Try a clinic or speciality in Indiranagar, Koramangala or Whitefield. Public map data may have gaps.'}</span></div>}
                </div>
                <div className="safety-note"><ShieldCheck size={16} /><span>{directorySource === 'osm' ? <>Listing details © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Listings can be incomplete; verify with providers directly. ClinicConnect does not diagnose or provide treatment advice.</> : 'ClinicConnect helps with appointment booking. It does not diagnose or provide treatment advice.'}</span></div>
              </section>

              <aside className="assistant-column">
                <div className="assistant-card">
                  <div className="assistant-head"><div className="assistant-icon"><Sparkles size={19} /></div><div><h2>Booking assistant</h2><span><i /> Ready to help</span></div><button className="more-button" aria-label="Assistant options">•••</button></div>
                  <div className="assistant-rule" />
                  <div className="bot-message"><div className="bot-avatar"><Sparkles size={14} /></div><div><span className="message-time">JUST NOW</span><p>Hi Sakshi! Tell me what you’re looking for in your own words. You can describe a concern, service, or preferred time.</p></div></div>
                  {assistantResult && <div className="assistant-response"><span className="response-label">{assistantResult.source === 'demo-rules' ? 'BOOKING SUGGESTION' : 'ASSISTANT'}</span><p>{assistantResult.message}</p>{assistantResult.suggestedService && <div className="suggested-service"><Stethoscope size={15} /><span>Suggested service</span><strong>{assistantResult.suggestedService}</strong><button onClick={() => { setService(assistantResult.suggestedService); setAssistantResult({ ...assistantResult, message: `Showing clinic profiles that list ${assistantResult.suggestedService}. Please confirm this service matches what you want to book.` }) }}>Use this</button></div>}</div>}
                  <div className="prompt-label">TRY ASKING</div>
                  <div className="quick-prompts">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => askAssistant(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div>
                  <div className="assistant-compose"><textarea value={assistantText} onChange={(event) => setAssistantText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); askAssistant() } }} placeholder={language === 'kn' ? 'ನಿಮಗೆ ಏನು ಬೇಕು ಎಂದು ಹೇಳಿ…' : 'Describe what you’re looking for…'} rows={2} aria-label="Describe what you need" /><div className="compose-actions"><span><AudioLines size={15} /> {isListening ? 'Listening…' : `Voice input · ${language === 'en' ? 'English' : 'ಕನ್ನಡ'}`}</span><button className="voice-button" onClick={listenForRequest} disabled={isListening} aria-label="Speak your request"><Mic size={16} /></button><button disabled={isThinking || !assistantText.trim()} onClick={() => askAssistant()} aria-label="Send message">{isThinking ? <span className="spinner" /> : <ArrowRight size={17} />}</button></div></div>
                  <div className="assistant-disclaimer">{aiEnabled && aiConsent ? 'AI matching is on. Your text transcript is sent to OpenAI for request matching; it is not used to diagnose or provide treatment advice.' : 'Basic matching runs on this app. No AI provider receives your request unless you opt in below.'} Voice audio is handled by your browser speech service; this app receives the resulting text.</div>
                  {aiEnabled && <label className="ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> Use AI matching (sends this text request to OpenAI)</label>}
                </div>
                <div className="whatsapp-card"><div className="whatsapp-badge"><MessageCircle size={18} /></div><div><strong>Prefer to talk?</strong><span>WhatsApp voice booking is on our roadmap.</span></div><ArrowRight size={16} /></div>
              </aside>
            </div>
          </div>
        )}

        {activeView === 'appointments' && <AppointmentsPage appointments={appointments} account={account} onUpdate={updateAppointment} onBrowse={() => setActiveView('discover')} />}
        {activeView === 'clinic' && <ClinicPage appointments={appointments} onUpdate={updateAppointment} account={account} setAccount={setAccount} />}
      </main>

      {bookingClinic && <BookingModal clinic={bookingClinic} slot={bookingSlot} day={selectedDay} name={patientName} phone={patientPhone} setName={setPatientName} setPhone={setPatientPhone} state={bookingState} account={account} setAccount={setAccount} onPatientName={setPatientName} onSubmit={submitBooking} onClose={() => { setBookingClinic(null); setBookingState('idle') }} onRetry={() => setBookingState('idle')} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  )
}

function ClinicCard({ clinic, onBook, saved, onSave }) {
  const Icon = iconMap[clinic.services[0]] || Stethoscope
  return (
    <article className="clinic-card">
      <div className={`clinic-art art-${clinic.accent}`}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="clinic-art-icon"><Icon size={27} /></div><span className="art-label">{clinic.artLabel}</span></div>
      <div className="clinic-details">
        <div className="clinic-title-row"><div><div className="clinic-tags"><span className="verified"><ShieldCheck size={12} /> {clinic.source === 'OpenStreetMap' ? 'OSM LISTING' : clinic.source === 'partner' ? 'APPROVED PARTNER' : 'SAMPLE PROFILE'}</span>{clinic.languages?.map((language) => <span key={language} className="language-tag">{language}</span>)}</div><h3>{clinic.name}</h3><p className="clinic-location"><MapPin size={14} /> {clinic.area} <span>·</span> {clinic.address}</p></div><button className={`favorite-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Unsave' : 'Save'} ${clinic.name}`} onClick={onSave}>{saved ? '♥' : '♡'}</button></div>
        <p className="clinic-description">{clinic.description}</p>
        <div className="clinic-meta"><span><Clock3 size={14} /> {clinic.openingLabel}</span><span className="service-label"><Stethoscope size={14} /> {clinic.services.join(' · ')}</span></div>
        {clinic.source === 'OpenStreetMap' ? <div className="real-data-actions">{clinic.phone && <a href={`tel:${clinic.phone}`}><MessageCircle size={13} /> {clinic.phone}</a>}{clinic.website && <a href={clinic.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={13} /></a>}<a href={clinic.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} /> Directions</a></div> : <><div className="slot-row"><strong>Available times</strong><div className="slot-list">{clinic.slots.length ? clinic.slots.slice(0, 3).map((slot) => <button key={slot.time} onClick={() => onBook(clinic, slot.time)}>{slot.time}</button>) : <span className="no-slots">No slots on this day</span>}</div></div><button className="view-clinic" onClick={() => clinic.slots[0] && onBook(clinic, clinic.slots[0].time)}>Book first available <ArrowRight size={15} /></button></>}
      </div>
    </article>
  )
}

function BookingModal({ clinic, slot, day, name, phone, setName, setPhone, state, account, setAccount, onPatientName, onSubmit, onClose, onRetry }) {
  const [accessMode, setAccessMode] = useState('register')
  const [accessName, setAccessName] = useState('')
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessError, setAccessError] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const partnerBooking = clinic.source === 'partner'
  const date = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day}T12:00:00`))
  async function submitAccess(event) {
    event.preventDefault()
    setAccessBusy(true)
    setAccessError('')
    try {
      const response = await fetch(`/api/auth/${accessMode === 'register' ? 'register-patient' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accessName, email: accessEmail, password: accessPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not sign in')
      if (data.user.role !== 'patient') throw new Error('Use a patient account for booking. Clinic accounts belong in the clinic portal.')
      setAccount(data.user)
      if (data.user.name) onPatientName(data.user.name)
    } catch (error) { setAccessError(error.message) } finally { setAccessBusy(false) }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-top"><span className="modal-kicker"><CalendarDays size={15} /> APPOINTMENT REQUEST</span><button className="close-modal" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        {state === 'done' ? <div className="booking-success"><div className="success-mark"><Check size={28} /></div><div className="eyebrow">REQUEST SUBMITTED</div><h2 id="booking-title">You’re on your way.</h2><p>Your appointment request for <strong>{clinic.name}</strong> {partnerBooking ? 'was sent to the clinic.' : 'is in the sample clinic queue.'}</p><div className="booking-summary"><span>{date}</span><strong>{slot}</strong></div><p className="pending-note">Status: Pending clinic confirmation.{partnerBooking ? '' : ' This is sample data and no real clinic was contacted.'}</p><button className="primary-button full-button" onClick={onClose}>Done <ArrowRight size={16} /></button></div> : <>
          <h2 id="booking-title">Request this appointment</h2><p className="modal-intro">{partnerBooking ? 'Sign in with a patient account to send a request to this clinic.' : 'We’ll share only the details needed for this sample booking.'}</p>
          <div className="selected-clinic"><div className={`small-clinic-icon art-${clinic.accent}`}><Stethoscope size={18} /></div><div><strong>{clinic.name}</strong><span>{date} · {slot}</span></div></div>
          {state === 'conflict' && <div className="form-alert">That sample slot was just taken. Choose another available time.</div>}
          {state === 'error' && <div className="form-alert">We couldn’t submit the request. Please retry.</div>}
          {partnerBooking && account?.role !== 'patient' ? <>
            <div className="auth-tabs"><button className={accessMode === 'register' ? 'selected' : ''} onClick={() => setAccessMode('register')}>Create account</button><button className={accessMode === 'login' ? 'selected' : ''} onClick={() => setAccessMode('login')}>Sign in</button></div>
            {accessError && <div className="form-alert">{accessError}</div>}
            <form onSubmit={submitAccess} className="booking-form">
              {accessMode === 'register' && <label>Your name<input required maxLength="80" value={accessName} onChange={(event) => setAccessName(event.target.value)} autoComplete="name" /></label>}
              <label>Email<input required type="email" value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} autoComplete="email" /></label>
              <label>Password<input required type="password" minLength="12" value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} autoComplete={accessMode === 'register' ? 'new-password' : 'current-password'} /></label>
              <div className="privacy-hint"><ShieldCheck size={15} /> Partner booking requests are shared with this clinic. Do not include medical details here.</div>
              <button className="primary-button full-button" type="submit" disabled={accessBusy}>{accessBusy ? 'Please wait…' : accessMode === 'register' ? 'Create patient account' : 'Sign in'}</button>
            </form>
          </> : <form onSubmit={onSubmit} className="booking-form"><label>Your name<input required maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" autoComplete="name" /></label><label>Phone number<input required maxLength="20" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 98765 43210" autoComplete="tel" /></label><div className="privacy-hint"><ShieldCheck size={15} /> {partnerBooking ? 'Your name and phone will be sent to this clinic for the appointment.' : 'Use sample details only. Do not enter real health information.'}</div><button className="primary-button full-button" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Submitting…' : 'Submit booking request'} <ArrowRight size={16} /></button></form>}
          <button className="text-button" onClick={state === 'conflict' ? onRetry : onClose}>{state === 'conflict' ? 'Choose a different time' : 'Cancel'}</button>
        </>}
      </section>
    </div>
  )
}

function AppointmentsPage({ appointments, account, onUpdate, onBrowse }) {
  const label = account?.role === 'patient' ? 'Your partner clinic bookings are stored with your account.' : 'Sample data stored in this demo session.'
  return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> YOUR SCHEDULE</div><h1>My appointments</h1><p className="welcome-sub">Track requests and see updates from clinics.</p><div className="secondary-panel"><div className="panel-heading"><div><h2>Appointment requests</h2><p>{label}</p></div><CalendarDays size={21} /></div>{appointments.length ? appointments.map((appointment) => <div className="appointment-row" key={appointment.id}><div className="appointment-date"><strong>{appointment.dateLabel}</strong><span>{appointment.time}</span></div><div className="appointment-info"><strong>{appointment.clinicName}</strong><span>{appointment.service} · {appointment.patientName}</span></div><span className={`status-chip status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>{account?.role === 'patient' && appointment.source === 'partner' && ['Pending', 'Confirmed'].includes(appointment.status) && <button className="decline-button" onClick={() => onUpdate(appointment.id, 'Cancelled')}>Cancel</button>}</div>) : <div className="empty-state large-empty"><CalendarDays size={24} /><strong>No appointments yet</strong><span>When you submit a booking request, it will appear here.</span><button className="primary-button" onClick={onBrowse}>Find a clinic <ArrowRight size={15} /></button></div>}</div></div>
}

function ClinicPage({ appointments, onUpdate, account, setAccount }) {
  const [accessMode, setAccessMode] = useState('register')
  const [form, setForm] = useState({ clinicName: '', email: '', password: '', area: 'Indiranagar', address: '', phone: '', website: '', services: ['General medicine'], times: '9:00 am, 12:00 pm, 4:00 pm', availabilityDays: [1, 2, 3, 4, 5, 6], languages: ['English'] })
  const [profile, setProfile] = useState(null)
  const [adminClinics, setAdminClinics] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requests = appointments.filter((appointment) => appointment.status === 'Pending')

  useEffect(() => {
    let current = true
    if (account?.role === 'clinic') fetch('/api/clinic/me').then((response) => response.json()).then((data) => {
      if (!current || !data.clinic) return
      setProfile(data.clinic)
      setForm((previous) => ({ ...previous, clinicName: data.clinic.name, area: data.clinic.area, address: data.clinic.address, phone: data.clinic.phone, website: data.clinic.website || '', services: data.clinic.services || [], times: (data.clinic.times || []).join(', '), availabilityDays: data.clinic.availabilityDays || [1, 2, 3, 4, 5, 6], languages: data.clinic.languages || ['English'] }))
    }).catch(() => setError('Could not load your clinic profile.'))
    if (account?.role === 'admin') fetch('/api/admin/clinics').then((response) => response.json()).then((data) => { if (current) setAdminClinics(data.clinics || []) }).catch(() => setError('Could not load clinic applications.'))
    return () => { current = false }
  }, [account?.id, account?.role])

  function change(field, value) { setForm((previous) => ({ ...previous, [field]: value })) }
  function toggleList(field, value) { setForm((previous) => ({ ...previous, [field]: previous[field].includes(value) ? previous[field].filter((item) => item !== value) : [...previous[field], value] })) }

  async function submitAccess(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const registering = accessMode === 'register'
    try {
      const response = await fetch(`/api/auth/${registering ? 'register-clinic' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registering ? form : { email: form.email, password: form.password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not sign in')
      if ((accessMode === 'admin' && data.user.role !== 'admin') || (accessMode !== 'admin' && data.user.role !== 'clinic')) throw new Error(accessMode === 'admin' ? 'These credentials are not a platform administrator account.' : 'These credentials are not a clinic account.')
      setAccount(data.user)
      if (data.clinic) setProfile(data.clinic)
      setMessage(registering ? 'Clinic account created. Complete your schedule, then request platform review.' : 'Signed in successfully.')
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const payload = { ...form, times: form.times.split(',').map((item) => item.trim()).filter(Boolean) }
    try {
      const response = await fetch('/api/clinic/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save profile')
      setProfile(data.clinic); setMessage('Clinic profile and weekly schedule saved.')
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  async function reviewClinic(id, active) {
    setError('')
    try {
      const response = await fetch(`/api/admin/clinics/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update review')
      setAdminClinics((current) => current.map((clinic) => clinic.id === id ? data.clinic : clinic))
    } catch (issue) { setError(issue.message) }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setAccount(null); setProfile(null); setMessage('Signed out.')
  }

  if (account?.role === 'patient') return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div><h1>Patient account</h1><p className="welcome-sub">Signed in as {account.email}. Partner booking requests will appear under My appointments.</p><button className="text-button" onClick={signOut}>Sign out</button></div>

  const serviceChoices = ['Dentistry', 'ENT', 'Dermatology', 'General medicine', 'Clinic']
  const dayChoices = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]]
  return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> CLINIC WORKSPACE</div><h1>Clinic portal</h1><p className="welcome-sub">Register your clinic, manage its listing and schedule, and review booking requests.</p>
    {error && <div className="form-alert">{error}</div>}{message && <div className="form-success">{message}</div>}
    {!account && <div className="secondary-panel access-panel"><div className="auth-tabs"><button className={accessMode === 'register' ? 'selected' : ''} onClick={() => setAccessMode('register')}>Register clinic</button><button className={accessMode === 'login' ? 'selected' : ''} onClick={() => setAccessMode('login')}>Clinic sign in</button><button className={accessMode === 'admin' ? 'selected' : ''} onClick={() => setAccessMode('admin')}>Admin sign in</button></div>
      {accessMode === 'admin' && <p className="privacy-hint"><ShieldCheck size={15} /> For the ClinicConnect platform administrator. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` saved in the server environment.</p>}
      <form onSubmit={submitAccess} className="portal-form">
        {accessMode === 'register' && <><label>Clinic name<input required maxLength="100" value={form.clinicName} onChange={(event) => change('clinicName', event.target.value)} /></label><label>Area<input required maxLength="80" value={form.area} onChange={(event) => change('area', event.target.value)} /></label><label>Street address<input required maxLength="200" value={form.address} onChange={(event) => change('address', event.target.value)} /></label><label>Clinic phone<input required maxLength="24" value={form.phone} onChange={(event) => change('phone', event.target.value)} /></label><fieldset><legend>Services</legend><div className="choice-row">{serviceChoices.map((item) => <label key={item}><input type="checkbox" checked={form.services.includes(item)} onChange={() => toggleList('services', item)} />{item}</label>)}</div></fieldset></>}
        <label>{accessMode === 'admin' ? 'Administrator email' : 'Clinic email'}<input required type="email" autoComplete="email" value={form.email} onChange={(event) => change('email', event.target.value)} /></label><label>Password<input required type="password" minLength="12" autoComplete={accessMode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => change('password', event.target.value)} /><small>Use at least 12 characters.</small></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : accessMode === 'register' ? 'Create clinic account' : accessMode === 'admin' ? 'Sign in as administrator' : 'Sign in'} <ArrowRight size={15} /></button>
      </form><p className="privacy-hint"><ShieldCheck size={15} /> New clinic listings stay hidden from patients until a platform administrator approves them.</p>
    </div>}
    {account?.role === 'clinic' && profile && <>
      <div className="clinic-dashboard-banner"><div className="dashboard-icon"><Stethoscope size={21} /></div><div><strong>{profile.name}</strong><span>{account.email} · {profile.verificationStatus || 'Pending review'}</span></div><span className="dashboard-state"><i /> {profile.active ? 'APPROVED' : 'PENDING'}</span><button className="text-button" onClick={signOut}>Sign out</button></div>
      <div className="secondary-panel"><div className="panel-heading"><div><h2>Clinic profile & availability</h2><p>Only your clinic can edit this listing.</p></div><CalendarDays size={21} /></div>
        <form onSubmit={saveProfile} className="portal-form"><label>Clinic name<input required value={form.clinicName} onChange={(event) => change('clinicName', event.target.value)} /></label><label>Area<input required value={form.area} onChange={(event) => change('area', event.target.value)} /></label><label>Street address<input required value={form.address} onChange={(event) => change('address', event.target.value)} /></label><label>Phone<input required value={form.phone} onChange={(event) => change('phone', event.target.value)} /></label><label>Website (optional, https)<input value={form.website} onChange={(event) => change('website', event.target.value)} placeholder="https://example.com" /></label>
          <fieldset><legend>Services</legend><div className="choice-row">{serviceChoices.map((item) => <label key={item}><input type="checkbox" checked={form.services.includes(item)} onChange={() => toggleList('services', item)} />{item}</label>)}</div></fieldset>
          <fieldset><legend>Days open</legend><div className="choice-row">{dayChoices.map(([label, value]) => <label key={value}><input type="checkbox" checked={form.availabilityDays.includes(value)} onChange={() => toggleList('availabilityDays', value)} />{label}</label>)}</div></fieldset>
          <label>Appointment times (comma separated)<input required value={form.times} onChange={(event) => change('times', event.target.value)} placeholder="9:00 am, 1:30 pm, 4:00 pm" /><small>12-hour format, for example 9:00 am. Use only times your clinic can honor.</small></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile and schedule'} <Check size={15} /></button>
        </form>
      </div>
      <div className="secondary-panel"><div className="panel-heading"><div><h2>Incoming appointments</h2><p>{requests.length} pending request{requests.length === 1 ? '' : 's'}</p></div><ArrowDownLeft size={21} /></div>{appointments.length ? appointments.map((appointment) => <div className="clinic-request-row" key={appointment.id}><div className="patient-avatar"><UserRound size={17} /></div><div className="request-main"><strong>{appointment.patientName}</strong><span>{appointment.service} · {appointment.dateLabel} at {appointment.time} · {appointment.phone}</span></div><span className={`status-chip status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>{appointment.status === 'Pending' && <div className="request-actions"><button className="decline-button" onClick={() => onUpdate(appointment.id, 'Declined')}>Decline</button><button className="confirm-button" onClick={() => onUpdate(appointment.id, 'Confirmed')}><Check size={14} /> Confirm</button></div>}</div>) : <div className="empty-state large-empty"><CalendarDays size={24} /><strong>No booking requests</strong><span>Requests for this clinic will show here.</span></div>}</div>
    </>}
    {account?.role === 'admin' && <><div className="clinic-dashboard-banner"><div className="dashboard-icon"><ShieldCheck size={21} /></div><div><strong>Platform review</strong><span>Approve only clinics whose identity and details you have checked.</span></div><button className="text-button" onClick={signOut}>Sign out</button></div><div className="secondary-panel"><div className="panel-heading"><div><h2>Clinic applications</h2><p>{adminClinics.filter((clinic) => !clinic.active).length} awaiting review</p></div></div>{adminClinics.length ? adminClinics.map((clinic) => <div className="clinic-request-row" key={clinic.id}><div className="request-main"><strong>{clinic.name}</strong><span>{clinic.area} · {clinic.address} · {clinic.ownerEmail}</span><span>{clinic.services.join(', ')} · {clinic.times?.length || 0} appointment times</span></div><span className={`status-chip ${clinic.active ? 'status-confirmed' : 'status-pending'}`}>{clinic.verificationStatus || 'Pending'}</span>{!clinic.active && <div className="request-actions"><button className="confirm-button" disabled={!clinic.times?.length} onClick={() => reviewClinic(clinic.id, true)}><Check size={14} /> Approve</button></div>}</div>) : <div className="empty-state large-empty"><ShieldCheck size={24} /><strong>No clinic applications</strong></div>}</div></>}
  </div>
}

export default App
