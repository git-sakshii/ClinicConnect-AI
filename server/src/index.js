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
memory.users = []
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
const sessionSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')
const loginAttempts = new Map()

function authToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url')
  return `${body}.${signature}`
}

function readAuth(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('cc_session='))
  if (!cookie) return null
  const [body, supplied] = cookie.slice('cc_session='.length).split('.')
  if (!body || !supplied) return null
  const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest()
  let actual
  try { actual = Buffer.from(supplied, 'base64url') } catch { return null }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null
  try {
    const user = JSON.parse(Buffer.from(body, 'base64url').toString())
    return user.exp > Date.now() ? user : null
  } catch { return null }
}

function setSession(response, user) {
  const token = authToken({ id: user.id, role: user.role, email: user.email, name: user.name || '' })
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader('Set-Cookie', `cc_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`)
}

function requireRole(...roles) {
  return (request, response, next) => {
    request.auth = readAuth(request)
    if (!request.auth || (roles.length && !roles.includes(request.auth.role))) return response.status(401).json({ error: 'Please sign in to continue.' })
    next()
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`${salt}:${key.toString('hex')}`)))
}

async function passwordMatches(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false
  const [salt, digest] = stored.split(':')
  const key = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, value) => error ? reject(error) : resolve(value)))
  const expected = Buffer.from(digest, 'hex')
  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}

async function findUser(email) {
  return db ? db.collection('users').findOne({ email }) : memory.users.find((user) => user.email === email) || null
}

async function saveUser(user) {
  if (db) await db.collection('users').insertOne(user)
  else memory.users.push(user)
}

async function userClinic(userId) {
  return db ? clinicCollection().findOne({ ownerId: userId }) : memory.clinics.find((clinic) => clinic.ownerId === userId) || null
}

async function saveClinic(clinic) {
  if (db) await clinicCollection().insertOne(clinic)
  else memory.clinics.push(clinic)
}

async function publicClinic(clinic, date) {
  const publicProfile = { ...clinic }
  for (const field of ['ownerId', 'ownerEmail', 'active', 'createdAt', 'updatedAt', 'reviewedAt']) delete publicProfile[field]
  const weekday = new Date(`${date}T12:00:00+05:30`).getDay()
  if (Array.isArray(clinic.availabilityDays) && !clinic.availabilityDays.includes(weekday)) return { ...publicProfile, slots: [] }
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
    return { ...publicProfile, slots: clinic.times.filter((time) => available.has(time)).map((time) => ({ time })) }
  }
  return { ...publicProfile, slots: clinic.times.filter((time) => !memory.reservedSlots.has(`${clinic.id}:${date}:${time}`)).map((time) => ({ time })) }
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
      latitude: lat, longitude: lon,
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

app.post('/api/auth/register-clinic', async (request, response, next) => {
  try {
    const { clinicName, email, password, area, address, phone, services } = request.body || {}
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const cleanName = typeof clinicName === 'string' ? clinicName.trim() : ''
    const serviceList = Array.isArray(services) ? [...new Set(services.filter((item) => ['Dentistry', 'ENT', 'Dermatology', 'General medicine', 'Clinic'].includes(item)))] : []
    if (!cleanName || cleanName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 12 || password.length > 128 || !area || !address || !phone || serviceList.length === 0) {
      return response.status(400).json({ error: 'Add the clinic details, a valid email, at least one service, and a password of 12 or more characters.' })
    }
    if (await findUser(cleanEmail)) return response.status(409).json({ error: 'An account with this email already exists.' })
    const now = new Date().toISOString()
    const user = { id: crypto.randomUUID(), email: cleanEmail, passwordHash: await hashPassword(password), role: 'clinic', createdAt: now }
    const clinic = {
      id: crypto.randomUUID(), ownerId: user.id, ownerEmail: cleanEmail, source: 'partner', name: cleanName,
      area: String(area).trim().slice(0, 80), address: String(address).trim().slice(0, 200),
      phone: String(phone).trim().slice(0, 24), services: serviceList, languages: ['English'],
      openingLabel: 'Hours set by clinic', description: 'Clinic profile provided by its operator.',
      accent: 'teal', artLabel: serviceList[0].toUpperCase(), times: [], availabilityDays: [1, 2, 3, 4, 5, 6],
      active: false, verificationStatus: 'Pending', createdAt: now,
    }
    await saveUser(user)
    await saveClinic(clinic)
    setSession(response, user)
    response.status(201).json({ user: { id: user.id, email: user.email, role: user.role }, clinic: { ...clinic, passwordHash: undefined } })
  } catch (error) { next(error) }
})

app.post('/api/auth/register-patient', async (request, response, next) => {
  try {
    const { name, email, password } = request.body || {}
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const cleanName = typeof name === 'string' ? name.trim() : ''
    if (!cleanName || cleanName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 12 || password.length > 128) return response.status(400).json({ error: 'Add your name, a valid email, and a password of at least 12 characters.' })
    if (await findUser(cleanEmail)) return response.status(409).json({ error: 'An account with this email already exists.' })
    const user = { id: crypto.randomUUID(), email: cleanEmail, name: cleanName, passwordHash: await hashPassword(password), role: 'patient', createdAt: new Date().toISOString() }
    await saveUser(user)
    setSession(response, user)
    response.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (error) { next(error) }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const { email, password } = request.body || {}
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const key = `${request.ip}:${cleanEmail}`
    const prior = loginAttempts.get(key)
    if (prior && prior.count >= 8 && Date.now() - prior.startedAt < 15 * 60 * 1000) return response.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
    if (prior && Date.now() - prior.startedAt >= 15 * 60 * 1000) loginAttempts.delete(key)
    const isAdmin = cleanEmail && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && cleanEmail === process.env.ADMIN_EMAIL.trim().toLowerCase() && password === process.env.ADMIN_PASSWORD
    const user = isAdmin ? { id: 'platform-admin', email: cleanEmail, role: 'admin' } : await findUser(cleanEmail)
    const valid = isAdmin || (user && typeof password === 'string' && await passwordMatches(password, user.passwordHash))
    if (!valid) {
      const attempt = loginAttempts.get(key) || { count: 0, startedAt: Date.now() }
      attempt.count += 1
      loginAttempts.set(key, attempt)
      return response.status(401).json({ error: 'Email or password is incorrect.' })
    }
    loginAttempts.delete(key)
    setSession(response, user)
    const clinic = user.role === 'clinic' ? await userClinic(user.id) : null
    response.json({ user: { id: user.id, email: user.email, name: user.name || '', role: user.role }, clinic })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', async (request, response, next) => {
  try {
    const user = readAuth(request)
    if (!user) return response.json({ user: null })
    const profile = user.role === 'clinic' ? await userClinic(user.id) : null
    response.json({ user: { id: user.id, email: user.email, name: user.name || '', role: user.role }, clinic: profile })
  } catch (error) { next(error) }
})

app.post('/api/auth/logout', (_request, response) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader('Set-Cookie', `cc_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`)
  response.json({ ok: true })
})

app.get('/api/clinic/me', requireRole('clinic'), async (request, response, next) => {
  try { response.json({ clinic: await userClinic(request.auth.id) }) } catch (error) { next(error) }
})

app.put('/api/clinic/me', requireRole('clinic'), async (request, response, next) => {
  try {
    const clinic = await userClinic(request.auth.id)
    if (!clinic) return response.status(404).json({ error: 'Clinic profile was not found.' })
    const { clinicName, area, address, phone, website, services, times, availabilityDays, languages } = request.body || {}
    const serviceList = Array.isArray(services) ? [...new Set(services.filter((item) => ['Dentistry', 'ENT', 'Dermatology', 'General medicine', 'Clinic'].includes(item)))] : []
    const slots = Array.isArray(times) ? [...new Set(times.filter((item) => typeof item === 'string' && /^(?:[1-9]|1[0-2]):[0-5]\d\s?(?:am|pm)$/i.test(item.trim())).map((item) => item.trim()))].slice(0, 20) : []
    const days = Array.isArray(availabilityDays) ? [...new Set(availabilityDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] : []
    const changes = {
      name: typeof clinicName === 'string' ? clinicName.trim().slice(0, 100) : clinic.name,
      area: typeof area === 'string' ? area.trim().slice(0, 80) : clinic.area,
      address: typeof address === 'string' ? address.trim().slice(0, 200) : clinic.address,
      phone: typeof phone === 'string' ? phone.trim().slice(0, 24) : clinic.phone,
      website: typeof website === 'string' && /^https:\/\//i.test(website) ? website.trim().slice(0, 250) : null,
      services: serviceList.length ? serviceList : clinic.services,
      times: slots,
      availabilityDays: days,
      languages: Array.isArray(languages) ? [...new Set(languages.filter((item) => ['English', 'Kannada', 'Hindi'].includes(item)))] : clinic.languages,
      artLabel: serviceList[0]?.toUpperCase() || clinic.artLabel,
      updatedAt: new Date().toISOString(),
    }
    if (!changes.name || !changes.area || !changes.address || !changes.phone || !changes.times.length || !changes.availabilityDays.length) return response.status(400).json({ error: 'Complete the profile, add at least one time, and select at least one available day.' })
    const needsReview = clinic.active && (changes.name !== clinic.name || changes.area !== clinic.area || changes.address !== clinic.address || changes.phone !== clinic.phone || JSON.stringify(changes.services) !== JSON.stringify(clinic.services))
    if (needsReview) Object.assign(changes, { active: false, verificationStatus: 'Pending' })
    if (db) await clinicCollection().updateOne({ id: clinic.id, ownerId: request.auth.id }, { $set: changes })
    else Object.assign(clinic, changes)
    response.json({ clinic: { ...clinic, ...changes } })
  } catch (error) { next(error) }
})

app.get('/api/admin/clinics', requireRole('admin'), async (_request, response, next) => {
  try {
    const clinics = db ? await clinicCollection().find({ source: 'partner' }).sort({ createdAt: -1 }).toArray() : memory.clinics.filter((clinic) => clinic.source === 'partner')
    response.json({ clinics })
  } catch (error) { next(error) }
})

app.patch('/api/admin/clinics/:id', requireRole('admin'), async (request, response, next) => {
  try {
    const { active } = request.body || {}
    if (typeof active !== 'boolean') return response.status(400).json({ error: 'Set active to true or false.' })
    const clinic = db ? await clinicCollection().findOne({ id: request.params.id, source: 'partner' }) : memory.clinics.find((item) => item.id === request.params.id && item.source === 'partner')
    if (!clinic) return response.status(404).json({ error: 'Clinic was not found.' })
    if (active && (!clinic.times?.length || !clinic.availabilityDays?.length)) return response.status(400).json({ error: 'The clinic must complete its weekly availability before approval.' })
    const changes = { active, verificationStatus: active ? 'Approved' : 'Pending', reviewedAt: new Date().toISOString() }
    if (db) await clinicCollection().updateOne({ id: clinic.id }, { $set: changes })
    else Object.assign(clinic, changes)
    response.json({ clinic: { ...clinic, ...changes } })
  } catch (error) { next(error) }
})

app.get('/api/clinics', async (request, response, next) => {
  try {
    const { search = '', area = '', service = '', source = 'demo', date = new Date().toISOString().slice(0, 10) } = request.query
    if (source === 'osm') {
      const clinics = await findOsmClinics(String(area || 'Any area'), String(service || 'All services'))
      return response.json({ clinics, source: 'OpenStreetMap', fetchedAt: new Date().toISOString(), attribution: '© OpenStreetMap contributors' })
    }
    let clinics = await getClinics()
    clinics = source === 'partners' ? clinics.filter((clinic) => clinic.source === 'partner' && clinic.active) : clinics.filter((clinic) => clinic.source !== 'partner')
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

app.get('/api/assistant/status', (_request, response) => response.json({ aiEnabled: Boolean(process.env.OPENAI_API_KEY) }))

async function interpretWithOpenAI(message, language) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions: `You help route appointment requests to clinic services. This is not medical advice. Never diagnose, recommend treatment, or infer a condition. Use only these service labels: ENT, Dentistry, Dermatology, General medicine. Suggest a service only when the user's own words clearly identify a relevant body area or explicitly name the service; for example acne or pimples can map to Dermatology. Otherwise use null. Extract an area only when explicitly named by the user; never guess a location from "near me". Detect if date and time preference are present. Reply in ${language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'}, briefly and neutrally. Ask the user to confirm any suggested service. Do not claim a booking is made or that slots are available.`,
      input: [{ role: 'user', content: message }],
      text: { format: { type: 'json_schema', name: 'booking_intent', strict: true, schema: {
        type: 'object', additionalProperties: false,
        properties: {
          suggestedService: { type: ['string', 'null'], enum: ['ENT', 'Dentistry', 'Dermatology', 'General medicine', null] },
          area: { type: ['string', 'null'], maxLength: 80 },
          dateMentioned: { type: 'boolean' },
          timeMentioned: { type: 'boolean' },
          message: { type: 'string' },
        },
        required: ['suggestedService', 'area', 'dateMentioned', 'timeMentioned', 'message'],
      } } },
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!upstream.ok) throw new Error(`AI provider returned ${upstream.status}`)
  const payload = await upstream.json()
  const output = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
  if (!output) throw new Error('AI provider returned no structured result')
  const parsed = JSON.parse(output)
  const services = ['ENT', 'Dentistry', 'Dermatology', 'General medicine']
  const mentionedArea = typeof parsed.area === 'string' && message.toLocaleLowerCase().includes(parsed.area.toLocaleLowerCase()) ? parsed.area.trim().slice(0, 80) : null
  return {
    source: 'openai',
    suggestedService: services.includes(parsed.suggestedService) ? parsed.suggestedService : null,
    area: mentionedArea,
    missing: [!parsed.dateMentioned && 'date', !parsed.timeMentioned && 'time'].filter(Boolean),
    message: typeof parsed.message === 'string' ? parsed.message.slice(0, 500) : 'Please confirm the service and preferred appointment details.',
  }
}

app.post('/api/assistant/interpret', async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim().slice(0, 500) : ''
  if (!message) return response.status(400).json({ error: 'Add a short description of what you are looking for.' })
  const language = /[\u0900-\u097F]/.test(message) ? 'hi' : /[\u0C80-\u0CFF]/.test(message) ? 'kn' : request.body?.language
  if (request.body?.allowAi === true && process.env.OPENAI_API_KEY) {
    try { return response.json(await interpretWithOpenAI(message, language)) }
    catch (error) {
      console.error('AI intent request failed:', error.message)
      return response.status(502).json({ error: 'AI matching is temporarily unavailable. Turn off AI matching or try again later.' })
    }
  }

  const text = message.toLowerCase()
  const mappings = [
    { keys: ['ear', 'nose', 'throat', 'hearing', 'ಕಿವಿ', 'ಮೂಗು', 'ಗಂಟಲು', 'ಕಿವಿನೋವು'], service: 'ENT', label: 'ear, nose or throat concern' },
    { keys: ['tooth', 'teeth', 'dent', 'gum', 'ಹಲ್ಲು', 'ದಂತ', 'ಹಲ್ಲುನೋವು'], service: 'Dentistry', label: 'dental appointment' },
    { keys: ['skin', 'rash', 'acne', 'pimple', 'pimples', 'face acne', 'facial acne', 'hair', 'मुंहासे', 'मुहांसे', 'मुंहासा', 'दाने', 'दाना', 'त्वचा', 'चेहरे पर दाने', 'चेहरे पर मुंहासे', 'muhase', 'muhase', 'daane', 'daana', 'chehre par dane', 'chehre par muhase', 'ಚರ್ಮ', 'ದದ್ದು', 'ಮೊಡವೆ'], service: 'Dermatology', label: 'skin or hair appointment' },
    { keys: ['general doctor', 'general medicine', 'check-up', 'checkup', 'ಸಾಮಾನ್ಯ ವೈದ್ಯ'], service: 'General medicine', label: 'general consultation' },
  ]
  const match = mappings.find((item) => item.keys.some((key) => text.includes(key)))
  const dateMentioned = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text) || /आज|कल|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार|ಇಂದು|ನಾಳೆ|ಸೋಮವಾರ|ಮಂಗಳವಾರ|ಬುಧವಾರ|ಗುರುವಾರ|ಶುಕ್ರವಾರ|ಶನಿವಾರ|ಭಾನುವಾರ/.test(text)
  const timeMentioned = /\b(morning|afternoon|evening|\d{1,2}(:\d{2})?\s?(am|pm))\b/i.test(text) || /सुबह|दोपहर|शाम|ಬೆಳಗ್ಗೆ|ಮಧ್ಯಾಹ್ನ|ಸಂಜೆ/.test(text)
  const kannada = language === 'kn'
  const hindi = language === 'hi'
  const mentionedArea = ['Koramangala', 'Indiranagar', 'Whitefield', 'Greater Noida'].find((item) => text.includes(item.toLowerCase())) || null
  response.json({
    source: 'demo-rules',
    suggestedService: match?.service || null,
    area: mentionedArea,
    missing: [!dateMentioned && 'date', !timeMentioned && 'time'].filter(Boolean),
    message: hindi
      ? (match ? `आपके अनुरोध से ${match.service} सेवा मेल खा सकती है। यह निदान नहीं है। क्लिनिक खोजने से पहले कृपया इस सेवा की पुष्टि करें।` : 'मैं इस विवरण से कोई क्लिनिक सेवा सुरक्षित रूप से नहीं चुन सका। सेवा चुनें या खोज फ़िल्टर का उपयोग करें।')
      : kannada
      ? (match ? `ನಿಮ್ಮ ವಿವರಣೆಗೆ ${match.service} ಸೇವೆ ಹೊಂದಿರಬಹುದು. ಮುಂದುವರಿಯುವ ಮೊದಲು ಈ ಸೇವೆಯನ್ನು ದೃಢೀಕರಿಸಿ.` : 'ಈ ವಿವರಣೆಗೆ ಸರಿಯಾದ ಸೇವೆಯನ್ನು ಖಚಿತಪಡಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸೇವೆಯ ಹೆಸರನ್ನು ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಕ್ಲಿನಿಕ್ ಹುಡುಕಾಟ ಬಳಸಿ.')
      : match
        ? `I found wording that may match ${match.label === 'ear, nose or throat concern' ? 'an' : 'a'} ${match.label}. I can show clinics that list ${match.service}; please confirm that this is the service you want to book.`
        : 'I could not safely match that wording to a sample service. Try a clinic-listed service or use the search filters.',
  })
})

app.get('/api/appointments', async (_request, response, next) => {
  try {
    const auth = readAuth(_request)
    const all = db
      ? await appointmentCollection().find({}).sort({ createdAt: -1 }).limit(100).toArray()
      : [...memory.appointments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    let appointments = all.filter((appointment) => appointment.source !== 'partner')
    if (auth?.role === 'admin') appointments = all
    if (auth?.role === 'clinic') {
      const clinic = await userClinic(auth.id)
      appointments = all.filter((appointment) => appointment.clinicId === clinic?.id)
    }
    if (auth?.role === 'patient') appointments = all.filter((appointment) => appointment.patientId === auth.id)
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
    if (clinic.source === 'partner' && !clinic.active) return response.status(403).json({ error: 'This clinic is not approved for bookings yet.' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00+05:30`).getTime()) || date < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Calcutta' })) return response.status(400).json({ error: 'Choose a valid appointment date that is not in the past.' })
    const weekday = new Date(`${date}T12:00:00+05:30`).getDay()
    if (Array.isArray(clinic.availabilityDays) && !clinic.availabilityDays.includes(weekday)) return response.status(400).json({ error: 'This clinic is closed on the selected day.' })
    const auth = readAuth(request)
    if (clinic.source === 'partner' && auth?.role !== 'patient') return response.status(401).json({ error: 'Create a patient account or sign in before requesting a partner clinic appointment.' })
    const key = `${clinicId}:${date}:${time}`
    const now = new Date().toISOString()
    const appointment = {
      id: crypto.randomUUID(), clinicId, clinicName: clinic.name, service, date, time,
      patientName: patientName.trim(), phone: phone.trim(), status: 'Pending', createdAt: now,
      ...(clinic.source === 'partner' ? { source: 'partner', patientId: auth.id } : { source: 'demo' }),
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
      if (current.source === 'partner') {
        const auth = readAuth(request)
        const clinic = auth?.role === 'clinic' ? await userClinic(auth.id) : null
        const patientCancel = auth?.role === 'patient' && auth.id === current.patientId && status === 'Cancelled' && ['Pending', 'Confirmed'].includes(current.status)
        if (auth?.role !== 'admin' && clinic?.id !== current.clinicId && !patientCancel) return response.status(403).json({ error: 'Only this clinic can update the booking. Patients may cancel their own pending or confirmed request.' })
      }
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
    if (appointment.source === 'partner') {
      const auth = readAuth(request)
      const clinic = auth?.role === 'clinic' ? await userClinic(auth.id) : null
      const patientCancel = auth?.role === 'patient' && auth.id === appointment.patientId && status === 'Cancelled' && ['Pending', 'Confirmed'].includes(appointment.status)
      if (auth?.role !== 'admin' && clinic?.id !== appointment.clinicId && !patientCancel) return response.status(403).json({ error: 'Only this clinic can update the booking. Patients may cancel their own pending or confirmed request.' })
    }
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
  if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || !process.env.MONGODB_URI || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
    throw new Error('Production requires AUTH_SECRET, MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD.')
  }
  if (process.env.MONGODB_URI) {
    client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    db = client.db(process.env.MONGODB_DATABASE || 'clinicconnect')
    await db.collection('slots').createIndex({ clinicId: 1, date: 1, time: 1 }, { unique: true })
    await appointmentCollection().createIndex({ id: 1 }, { unique: true })
    await appointmentCollection().createIndex({ clinicId: 1, date: 1, time: 1 })
    await appointmentCollection().createIndex({ patientId: 1, createdAt: -1 })
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await clinicCollection().createIndex({ id: 1 }, { unique: true })
    await clinicCollection().createIndex({ ownerId: 1 }, { unique: true, sparse: true })
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
