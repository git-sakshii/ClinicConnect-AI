import 'dotenv/config'
import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { MongoClient } from 'mongodb'

const PORT = Number(process.env.PORT || 3001)
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '32kb' }))

const seedClinics = [
  {
    id: 'aarogya-skin', name: 'Aarogya Skin & Wellness', area: 'Indiranagar', address: '12th Main Road',
    services: ['Dermatology'], languages: ['English', 'Kannada'], openingLabel: 'Open until 6:30 pm',
    description: 'A sample clinic profile for browsing skin and wellness appointments.', accent: 'teal', artLabel: 'SKIN & WELLNESS',
    times: ['10:30 am', '12:15 pm', '4:00 pm', '5:30 pm'],
  },
  {
    id: 'indira-dental', name: 'Indira Dental Studio', area: 'Indiranagar', address: '100 Feet Road',
    services: ['Dentistry'], languages: ['English', 'Hindi'], openingLabel: 'Open until 7:00 pm',
    description: 'A sample dental clinic listing with appointment times for the demo.', accent: 'blue', artLabel: 'DENTAL CARE',
    times: ['9:45 am', '11:30 am', '2:15 pm', '4:45 pm'],
  },
  {
    id: 'lakeview-ent', name: 'Lakeview ENT & Family Care', area: 'Indiranagar', address: 'CMH Road',
    services: ['ENT', 'General medicine'], languages: ['English', 'Kannada', 'Hindi'], openingLabel: 'Open until 5:00 pm',
    description: 'A sample profile for ear, nose and throat appointment discovery.', accent: 'warm', artLabel: 'ENT & FAMILY CARE',
    times: ['10:00 am', '1:00 pm', '3:30 pm', '4:15 pm'],
  },
  {
    id: 'namma-health', name: 'Namma Community Health', area: 'Koramangala', address: '5th Block',
    services: ['General medicine', 'Dermatology'], languages: ['English', 'Kannada'], openingLabel: 'Open until 8:00 pm',
    description: 'A sample neighborhood clinic profile with general appointment options.', accent: 'lilac', artLabel: 'COMMUNITY CARE',
    times: ['9:30 am', '12:00 pm', '3:00 pm', '6:15 pm'],
  },
]

const memory = { clinics: seedClinics, appointments: [], reservedSlots: new Set() }
const osmCache = new Map()
const osmInflight = new Map()
const areaBounds = {
  Indiranagar: { south: 12.955, west: 77.625, north: 13.01, east: 77.67 },
  Koramangala: { south: 12.91, west: 77.60, north: 12.96, east: 77.65 },
  Whitefield: { south: 12.94, west: 77.72, north: 13.04, east: 77.80 },
  'Any area': { south: 12.84, west: 77.50, north: 13.15, east: 77.82 },
}
let nominatimQueue = Promise.resolve()
let nominatimLastRequest = 0
let client
let db
let mode = 'demo-memory'

async function publicClinic(clinic, date) {
  if (db) {
    const slotKeys = clinic.times.map((time) => ({
      updateOne: {
        filter: { clinicId: clinic.id, date, time },
        update: { $setOnInsert: { clinicId: clinic.id, date, time, capacity: 1, remaining: 1 } },
        upsert: true,
      },
    }))
    await db.collection('slots').bulkWrite(slotKeys, { ordered: false })
    const available = new Set((await db.collection('slots').find({ clinicId: clinic.id, date, remaining: { $gt: 0 } }, { projection: { time: 1 } }).toArray()).map((slot) => slot.time))
    return { ...clinic, slots: clinic.times.filter((time) => available.has(time)).map((time) => ({ time })) }
  }
  return { ...clinic, slots: clinic.times.filter((time) => !memory.reservedSlots.has(`${clinic.id}:${date}:${time}`)).map((time) => ({ time })) }
}

function clinicCollection() { return db?.collection('clinics') }
function appointmentCollection() { return db?.collection('appointments') }

async function getClinics() {
  if (!db) return memory.clinics
  return db.collection('clinics').find({ active: { $ne: false } }).toArray()
}

function osmService(tags) {
  const value = `${tags.amenity || ''} ${tags.healthcare || ''} ${tags['healthcare:speciality'] || ''} ${tags.name || ''}`.toLowerCase()
  if (/dent|orthodont/.test(value)) return 'Dentistry'
  if (/(^|[^a-z])(ear|nose|throat|hearing|ent)([^a-z]|$)|otolaryng/.test(value)) return 'ENT'
  if (/dermat|skin/.test(value)) return 'Dermatology'
  return 'Clinic'
}

async function findOsmClinics(area, service) {
  // Send only generic provider/category and area terms upstream, never the user's free-text concern.
  const terms = { Dentistry: 'dentist', ENT: 'ENT doctor', Dermatology: 'dermatologist', 'General medicine': 'doctor' }
  const prompt = [service === 'All services' || !service ? 'clinic' : (terms[service] || service), area === 'Any area' ? 'Bengaluru' : area, 'Bengaluru'].join(' ').trim().replace(/\s+/g, ' ')
  const key = prompt.toLowerCase()
  const cached = osmCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.clinics
  if (osmInflight.has(key)) return osmInflight.get(key)
  const bounds = areaBounds[area] || areaBounds['Any area']
  const params = new URLSearchParams({ q: prompt, format: 'jsonv2', addressdetails: '1', limit: '30', viewbox: `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`, bounded: '1' })
  const performLookup = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - nominatimLastRequest))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    nominatimLastRequest = Date.now()
    const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'user-agent': 'ClinicConnectStudentPrototype/0.2 (+https://github.com/git-sakshii/ClinicConnect-AI)', accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    if (!upstream.ok) throw Object.assign(new Error(`OpenStreetMap lookup returned ${upstream.status}`), { statusCode: 502 })
    return upstream.json()
  }
  const pending = nominatimQueue.then(performLookup)
  nominatimQueue = pending.then(() => undefined, () => undefined)
  const result = pending.then((payload) => {
    const clinics = payload.map((place) => {
    const kind = `${place.category}/${place.type}`.toLowerCase()
    if (!['amenity/clinic', 'amenity/doctors', 'amenity/dentist', 'amenity/hospital', 'healthcare/clinic', 'healthcare/doctor', 'healthcare/dentist'].includes(kind) || !place.name) return null
    const placeName = place.name.toLowerCase()
    const matchesService = service === 'All services'
      || (service === 'Dentistry' && (place.type === 'dentist' || /dent|orthodont/.test(placeName)))
      || (service === 'ENT' && /(^|[^a-z])(ear|nose|throat|ent)([^a-z]|$)|otolaryng/.test(placeName))
      || (service === 'Dermatology' && /dermat|skin/.test(placeName))
      || (service === 'General medicine' && ['doctor', 'doctors'].includes(place.type))
      || (service === 'Clinic' && ['clinic', 'hospital'].includes(place.type))
    if (!matchesService) return null
    const address = place.address || {}
    const neighborhood = address.suburb || address.neighbourhood || address.city_district || address.city || area.replace('Any area', 'Bengaluru')
    const category = service !== 'All services' ? service : osmService({ amenity: place.type, name: place.name })
    const lat = Number(place.lat)
    const lon = Number(place.lon)
    if (lat < bounds.south || lat > bounds.north || lon < bounds.west || lon > bounds.east) return null
    const shortAddress = [address.house_number, address.road, address.neighbourhood || address.suburb, address.city || address.town].filter(Boolean).join(', ')
    return {
      id: `osm-${place.osm_type}-${place.osm_id}`, name: place.name, area: neighborhood,
      address: shortAddress || place.display_name,
      services: [category], languages: [], openingLabel: 'Hours not verified',
      description: 'Public OpenStreetMap result. Verify details and availability with the provider before visiting.',
      accent: 'teal', artLabel: category.toUpperCase(), slots: [], source: 'OpenStreetMap',
      osmUrl: `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
      mapsUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`,
      website: null, phone: null,
    }
    }).filter(Boolean)
    osmCache.set(key, { clinics, expiresAt: Date.now() + 60 * 60 * 1000 })
    return clinics
  })
  osmInflight.set(key, result)
  try { return await result } finally { osmInflight.delete(key) }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', mode, timestamp: new Date().toISOString() })
})

app.get('/api/clinics', async (request, response, next) => {
  try {
    const { search = '', area = '', service = '', source = 'demo', date = new Date().toISOString().slice(0, 10) } = request.query
    if (source === 'osm') {
      const clinics = await findOsmClinics(String(area || 'Any area'), String(service || 'All services'))
      return response.json({ clinics, source: 'OpenStreetMap', fetchedAt: new Date().toISOString(), attribution: '© OpenStreetMap contributors' })
    }
    let clinics = await getClinics()
    const term = String(search).trim().toLowerCase()
    const targetArea = String(area).trim().toLowerCase()
    const targetService = String(service).trim().toLowerCase()
    clinics = clinics.filter((clinic) => {
      const hasArea = !targetArea || targetArea === 'any area' || clinic.area.toLowerCase().includes(targetArea)
      const hasService = !targetService || clinic.services.some((item) => item.toLowerCase() === targetService)
      const haystack = [clinic.name, clinic.area, clinic.address, clinic.description, ...clinic.services].join(' ').toLowerCase()
      return hasArea && hasService && (!term || haystack.includes(term))
    })
    response.json({ clinics: await Promise.all(clinics.map((clinic) => publicClinic(clinic, String(date)))) })
  } catch (error) { next(error) }
})

app.post('/api/assistant/interpret', (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim().slice(0, 500) : ''
  if (!message) return response.status(400).json({ error: 'Add a short description of what you are looking for.' })

  const text = message.toLowerCase()
  const mappings = [
    { keys: ['ear', 'nose', 'throat', 'hearing', 'ಕಿವಿ', 'ಮೂಗು', 'ಗಂಟಲು', 'ಕಿವಿನೋವು'], service: 'ENT', label: 'ear, nose or throat concern' },
    { keys: ['tooth', 'teeth', 'dent', 'gum', 'ಹಲ್ಲು', 'ದಂತ', 'ಹಲ್ಲುನೋವು'], service: 'Dentistry', label: 'dental appointment' },
    { keys: ['skin', 'rash', 'acne', 'hair', 'ಚರ್ಮ', 'ದದ್ದು', 'ಮೊಡವೆ'], service: 'Dermatology', label: 'skin or hair appointment' },
    { keys: ['general doctor', 'general medicine', 'check-up', 'checkup', 'ಸಾಮಾನ್ಯ ವೈದ್ಯ'], service: 'General medicine', label: 'general consultation' },
  ]
  const match = mappings.find((item) => item.keys.some((key) => text.includes(key)))
  const dateMentioned = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text) || /ಇಂದು|ನಾಳೆ|ಸೋಮವಾರ|ಮಂಗಳವಾರ|ಬುಧವಾರ|ಗುರುವಾರ|ಶುಕ್ರವಾರ|ಶನಿವಾರ|ಭಾನುವಾರ/.test(text)
  const timeMentioned = /\b(morning|afternoon|evening|\d{1,2}(:\d{2})?\s?(am|pm))\b/i.test(text) || /ಬೆಳಗ್ಗೆ|ಮಧ್ಯಾಹ್ನ|ಸಂಜೆ/.test(text)
  const kannada = request.body?.language === 'kn'
  response.json({
    source: 'demo-rules',
    suggestedService: match?.service || null,
    area: /koramangala/i.test(text) ? 'Koramangala' : /indiranagar/i.test(text) ? 'Indiranagar' : null,
    missing: [!dateMentioned && 'date', !timeMentioned && 'time'].filter(Boolean),
    message: kannada
      ? (match ? `ನಿಮ್ಮ ವಿವರಣೆಗೆ ${match.service} ಸೇವೆ ಹೊಂದಿರಬಹುದು. ಮುಂದುವರಿಯುವ ಮೊದಲು ಈ ಸೇವೆಯನ್ನು ದೃಢೀಕರಿಸಿ.` : 'ಈ ವಿವರಣೆಗೆ ಸರಿಯಾದ ಸೇವೆಯನ್ನು ಖಚಿತಪಡಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸೇವೆಯ ಹೆಸರನ್ನು ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಕ್ಲಿನಿಕ್ ಹುಡುಕಾಟ ಬಳಸಿ.')
      : match
        ? `I found wording that may match a ${match.label}. I can show clinics that list ${match.service}; please confirm that this is the service you want to book.`
        : 'I could not safely match that wording to a sample service. Try a clinic-listed service or use the search filters.',
  })
})

app.get('/api/appointments', async (_request, response, next) => {
  try {
    const appointments = db
      ? await appointmentCollection().find({}).sort({ createdAt: -1 }).limit(100).toArray()
      : [...memory.appointments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    response.json({ appointments })
  } catch (error) { next(error) }
})

app.post('/api/appointments', async (request, response, next) => {
  try {
    const { clinicId, service, date, time, patientName, phone } = request.body || {}
    if (![clinicId, service, date, time, patientName, phone].every((value) => typeof value === 'string' && value.trim())) {
      return response.status(400).json({ error: 'Clinic, service, date, time, name and phone are required.' })
    }
    if (patientName.length > 80 || phone.length > 20 || !/^\+?[\d\s().-]{7,20}$/.test(phone)) {
      return response.status(400).json({ error: 'Check the name and phone fields.' })
    }
    const clinics = await getClinics()
    const clinic = clinics.find((item) => item.id === clinicId)
    if (!clinic || !clinic.services.includes(service) || !clinic.times.includes(time)) {
      return response.status(400).json({ error: 'Choose a service and time shown for this sample clinic.' })
    }
    const key = `${clinicId}:${date}:${time}`
    const now = new Date().toISOString()
    const appointment = {
      id: crypto.randomUUID(), clinicId, clinicName: clinic.name, service, date, time,
      patientName: patientName.trim(), phone: phone.trim(), status: 'Pending', createdAt: now,
      dateLabel: new Intl.DateTimeFormat('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${date}T12:00:00+05:30`)),
    }

    if (db) {
      const session = client.startSession()
      try {
        await session.withTransaction(async () => {
          const slotKey = { clinicId, date, time }
          await db.collection('slots').updateOne(slotKey, { $setOnInsert: { ...slotKey, capacity: 1, remaining: 1 } }, { upsert: true, session })
          const reserved = await db.collection('slots').updateOne({ ...slotKey, remaining: { $gt: 0 } }, { $inc: { remaining: -1 } }, { session })
          if (reserved.modifiedCount !== 1) throw Object.assign(new Error('That time was just taken. Please choose another slot.'), { statusCode: 409 })
          await appointmentCollection().insertOne(appointment, { session })
        })
      } finally { await session.endSession() }
    } else {
      if (memory.reservedSlots.has(key)) return response.status(409).json({ error: 'That time was just taken. Please choose another slot.' })
      memory.reservedSlots.add(key)
      memory.appointments.push(appointment)
    }
    response.status(201).json({ appointment })
  } catch (error) {
    if (error.statusCode === 409 || error.code === 11000) return response.status(409).json({ error: 'That time was just taken. Please choose another slot.' })
    next(error)
  }
})

app.patch('/api/appointments/:id', async (request, response, next) => {
  try {
    const { status } = request.body || {}
    if (!['Confirmed', 'Declined', 'Cancelled', 'Completed'].includes(status)) return response.status(400).json({ error: 'Unsupported appointment status.' })
    if (db) {
      const current = await appointmentCollection().findOne({ id: request.params.id })
      if (!current) return response.status(404).json({ error: 'Appointment was not found.' })
      const releaseSlot = ['Declined', 'Cancelled'].includes(status) && ['Pending', 'Confirmed'].includes(current.status)
      const session = client.startSession()
      let result
      try {
        await session.withTransaction(async () => {
          const updated = await appointmentCollection().findOneAndUpdate(
            { id: request.params.id, status: current.status },
            { $set: { status, updatedAt: new Date().toISOString() } },
            { returnDocument: 'after', session },
          )
          if (!updated) throw Object.assign(new Error('Appointment changed. Refresh and retry.'), { statusCode: 409 })
          result = updated
          if (releaseSlot) await db.collection('slots').updateOne({ clinicId: current.clinicId, date: current.date, time: current.time }, { $inc: { remaining: 1 } }, { session })
        })
      } finally { await session.endSession() }
      if (!result) return response.status(404).json({ error: 'Appointment was not found.' })
      return response.json({ appointment: result })
    }
    const appointment = memory.appointments.find((item) => item.id === request.params.id)
    if (!appointment) return response.status(404).json({ error: 'Appointment was not found.' })
    const wasActive = ['Pending', 'Confirmed'].includes(appointment.status)
    if (wasActive && ['Declined', 'Cancelled'].includes(status)) memory.reservedSlots.delete(`${appointment.clinicId}:${appointment.date}:${appointment.time}`)
    appointment.status = status
    appointment.updatedAt = new Date().toISOString()
    response.json({ appointment })
  } catch (error) { next(error) }
})

app.use((error, _request, response, _next) => {
  console.error(error.message)
  response.status(500).json({ error: 'The service could not complete that request.' })
})

async function start() {
  if (process.env.MONGODB_URI) {
    client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    db = client.db(process.env.MONGODB_DATABASE || 'clinicconnect')
    await db.collection('slots').createIndex({ clinicId: 1, date: 1, time: 1 }, { unique: true })
    await appointmentCollection().createIndex({ id: 1 }, { unique: true })
    if (await clinicCollection().countDocuments() === 0) await clinicCollection().insertMany(seedClinics.map((clinic) => ({ ...clinic, active: true })))
    mode = 'mongodb'
  } else {
    console.warn('MONGODB_URI is not configured. Starting with temporary in-memory demo data.')
  }
  app.listen(PORT, () => console.log(`ClinicConnect API listening on http://localhost:${PORT} (${mode})`))
}

start().catch((error) => {
  console.error('API startup failed:', error.message)
  process.exit(1)
})
