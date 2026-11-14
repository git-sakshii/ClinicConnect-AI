import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, AudioLines, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, HeartPulse, Languages,
  MapPin, MessageCircle, Mic, Plus, Search, ShieldCheck, Sparkles, Stethoscope, UserRound,
  X,
} from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const iconMap = { Dermatology: Activity, Dentistry: HeartPulse, ENT: Activity, 'General medicine': Stethoscope }
const quickPrompts = ['I have acne on my face', 'मुझे चेहरे पर मुंहासे हैं', 'मेरे कान में दर्द है', 'Find a dentist tomorrow']
const uiCopy = {
  en: {
    navDiscover: 'Find a clinic', navAppointments: 'My appointments', navClinic: 'Clinic portal', account: 'Account & profile',
    sidebarCaption: 'YOUR CARE, CONNECTED', needHelp: 'Need a hand?', helpIntro: 'Our team is happy to help you book.', getSupport: 'Get support',
    eyebrow: 'A CALMER WAY TO FIND CARE', title: 'Find care near you', welcome: 'Tell us what you need. We’ll help you find a clinic and a time that works.',
    guestWelcome: 'You’re browsing as a guest.', clinicName: 'Clinic name (optional)', searchPlaceholder: 'Search a clinic, service, or concern', area: 'Type an area', search: 'Search clinics',
    osmGuidance: 'Search public map listings by area and service; a clinic name is optional. These listings do not include bookable slots.',
    partnersGuidance: 'Search clinics registered and approved on ClinicConnect. Their published availability can be requested for booking.',
    demoGuidance: 'Search sample clinics and sample appointment slots for the prototype. Sample bookings do not contact a real clinic.',
    clinicsNear: 'Clinics near', clinicsDirectory: 'Clinics in the directory', osmSub: 'OpenStreetMap listings · contact clinics to confirm details and appointments',
    partnersSub: 'Approved clinics · times entered by clinic operators', demoSub: 'Sample profiles · availability shown for your selected day',
    filterService: 'Filter by service', directory: 'Directory', saved: 'saved', map: 'Clinic map', publicListings: 'public listings shown', noPins: 'No matching map pins for this search',
    mapCentered: 'Map centered on', assistant: 'Booking assistant', ready: 'Ready to help', assistantIntro: 'Hi! Tell me what you’re looking for in your own words. You can describe a concern, service, or preferred time.',
    tryAsking: 'TRY ASKING', compose: 'Describe what you’re looking for…', describeNeed: 'Describe what you need', listening: 'Listening…', voice: 'Voice input', speak: 'Speak your request', send: 'Send message',
    whatsappTitle: 'Prefer to talk?', whatsappText: 'WhatsApp voice booking is on our roadmap.',
    supportTitle: 'Support & quick help', supportIntro: 'A few tips to help you use ClinicConnect.', supportClose: 'Close support',
    helpSearchTitle: 'Find and book care', helpSearch: 'Use the directory selector to search public map listings, approved clinic partners, or sample clinics. Only approved partners and sample profiles offer booking in this prototype.',
    helpAssistantTitle: 'Use the assistant', helpAssistant: 'Describe a concern or service in English, Hindi, or Kannada. The assistant can suggest a clinic service, but it does not diagnose or recommend treatment.',
    helpClinicTitle: 'Clinic registration', helpClinic: 'Clinics can apply through the Clinic portal. A platform administrator must approve a clinic before it appears as a partner.',
    supportUnavailable: 'Direct support contact details have not been configured in this prototype.',
  },
  hi: {
    navDiscover: 'क्लिनिक खोजें', navAppointments: 'मेरी अपॉइंटमेंट', navClinic: 'क्लिनिक पोर्टल', account: 'खाता और प्रोफ़ाइल',
    sidebarCaption: 'आपकी देखभाल, एक साथ', needHelp: 'मदद चाहिए?', helpIntro: 'बुकिंग में हमारी टीम आपकी मदद करेगी।', getSupport: 'सहायता देखें',
    eyebrow: 'देखभाल पाने का आसान तरीका', title: 'अपने पास इलाज खोजें', welcome: 'अपनी ज़रूरत बताइए। हम आपके लिए क्लिनिक और सही समय खोजेंगे।',
    guestWelcome: 'आप अतिथि के रूप में देख रहे हैं।', clinicName: 'क्लिनिक का नाम (वैकल्पिक)', searchPlaceholder: 'क्लिनिक, सेवा या समस्या खोजें', area: 'इलाका लिखें', search: 'क्लिनिक खोजें',
    osmGuidance: 'इलाके और सेवा के अनुसार सार्वजनिक मानचित्र सूची खोजें; क्लिनिक का नाम वैकल्पिक है। इन सूचियों में बुकिंग स्लॉट नहीं होते।',
    partnersGuidance: 'ClinicConnect पर पंजीकृत और स्वीकृत क्लिनिक खोजें। उनकी उपलब्धता के लिए बुकिंग अनुरोध भेज सकते हैं।',
    demoGuidance: 'प्रोटोटाइप के नमूना क्लिनिक और अपॉइंटमेंट स्लॉट खोजें। नमूना बुकिंग किसी वास्तविक क्लिनिक तक नहीं जाती।',
    clinicsNear: 'पास के क्लिनिक:', clinicsDirectory: 'डायरेक्टरी के क्लिनिक', osmSub: 'OpenStreetMap सूची · जानकारी और अपॉइंटमेंट की पुष्टि क्लिनिक से करें',
    partnersSub: 'स्वीकृत क्लिनिक · समय क्लिनिक संचालकों द्वारा जोड़े गए', demoSub: 'नमूना प्रोफ़ाइल · चुने गए दिन की उपलब्धता',
    filterService: 'सेवा के अनुसार छाँटें', directory: 'डायरेक्टरी', saved: 'सहेजे गए', map: 'क्लिनिक मानचित्र', publicListings: 'सार्वजनिक स्थान दिखाए गए', noPins: 'इस खोज के लिए मानचित्र पर स्थान नहीं मिले',
    mapCentered: 'मानचित्र का केंद्र:', assistant: 'बुकिंग सहायक', ready: 'मदद के लिए तैयार', assistantIntro: 'नमस्ते! अपनी ज़रूरत अपने शब्दों में बताइए। समस्या, सेवा या पसंदीदा समय बता सकते हैं।',
    tryAsking: 'ऐसे पूछें', compose: 'बताइए आप क्या खोज रहे हैं…', describeNeed: 'अपनी ज़रूरत बताइए', listening: 'सुन रहे हैं…', voice: 'आवाज़ से पूछें', speak: 'अपनी बात बोलें', send: 'संदेश भेजें',
    whatsappTitle: 'बात करना पसंद है?', whatsappText: 'WhatsApp वॉइस बुकिंग भविष्य की योजना में है।',
    supportTitle: 'सहायता और त्वरित जानकारी', supportIntro: 'ClinicConnect इस्तेमाल करने के लिए कुछ सुझाव।', supportClose: 'सहायता बंद करें',
    helpSearchTitle: 'देखभाल खोजें और बुक करें', helpSearch: 'सार्वजनिक मानचित्र सूची, स्वीकृत क्लिनिक पार्टनर या नमूना क्लिनिक खोजने के लिए डायरेक्टरी चुनें। इस प्रोटोटाइप में केवल स्वीकृत पार्टनर और नमूना प्रोफ़ाइल बुकिंग देती हैं।',
    helpAssistantTitle: 'सहायक का उपयोग करें', helpAssistant: 'समस्या या सेवा अंग्रेज़ी, हिंदी या कन्नड़ में बताइए। सहायक सेवा सुझा सकता है, लेकिन बीमारी का निदान या इलाज नहीं बताता।',
    helpClinicTitle: 'क्लिनिक पंजीकरण', helpClinic: 'क्लिनिक पोर्टल से आवेदन करें। पार्टनर के रूप में दिखने से पहले प्लेटफ़ॉर्म एडमिन की मंज़ूरी ज़रूरी है।',
    supportUnavailable: 'इस प्रोटोटाइप में सीधे सहायता संपर्क की जानकारी अभी उपलब्ध नहीं है।',
  },
  kn: {
    navDiscover: 'ಕ್ಲಿನಿಕ್ ಹುಡುಕಿ', navAppointments: 'ನನ್ನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು', navClinic: 'ಕ್ಲಿನಿಕ್ ಪೋರ್ಟಲ್', account: 'ಖಾತೆ ಮತ್ತು ಪ್ರೊಫೈಲ್',
    sidebarCaption: 'ನಿಮ್ಮ ಆರೈಕೆ, ಒಂದೇ ಕಡೆ', needHelp: 'ಸಹಾಯ ಬೇಕೇ?', helpIntro: 'ಬುಕಿಂಗ್ ಮಾಡಲು ನಮ್ಮ ತಂಡ ಸಹಾಯ ಮಾಡುತ್ತದೆ.', getSupport: 'ಸಹಾಯ ಪಡೆಯಿರಿ',
    eyebrow: 'ಆರೈಕೆ ಹುಡುಕುವ ಸುಲಭ ಮಾರ್ಗ', title: 'ನಿಮ್ಮ ಹತ್ತಿರ ಆರೈಕೆ ಹುಡುಕಿ', welcome: 'ನಿಮಗೆ ಏನು ಬೇಕೆಂದು ತಿಳಿಸಿ. ಸೂಕ್ತ ಕ್ಲಿನಿಕ್ ಮತ್ತು ಸಮಯ ಹುಡುಕಲು ನಾವು ಸಹಾಯ ಮಾಡುತ್ತೇವೆ.',
    guestWelcome: 'ನೀವು ಅತಿಥಿಯಾಗಿ ಬ್ರೌಸ್ ಮಾಡುತ್ತಿದ್ದೀರಿ.', clinicName: 'ಕ್ಲಿನಿಕ್ ಹೆಸರು (ಐಚ್ಛಿಕ)', searchPlaceholder: 'ಕ್ಲಿನಿಕ್, ಸೇವೆ ಅಥವಾ ಸಮಸ್ಯೆ ಹುಡುಕಿ', area: 'ಪ್ರದೇಶ ನಮೂದಿಸಿ', search: 'ಕ್ಲಿನಿಕ್ ಹುಡುಕಿ',
    osmGuidance: 'ಪ್ರದೇಶ ಮತ್ತು ಸೇವೆಯ ಆಧಾರದ ಮೇಲೆ ಸಾರ್ವಜನಿಕ ನಕ್ಷೆ ಪಟ್ಟಿಗಳನ್ನು ಹುಡುಕಿ; ಕ್ಲಿನಿಕ್ ಹೆಸರು ಐಚ್ಛಿಕ. ಈ ಪಟ್ಟಿಗಳಲ್ಲಿ ಬುಕಿಂಗ್ ಸಮಯಗಳು ಇರುವುದಿಲ್ಲ.',
    partnersGuidance: 'ClinicConnect ನಲ್ಲಿ ನೋಂದಾಯಿಸಿ ಅನುಮೋದಿಸಲಾದ ಕ್ಲಿನಿಕ್‌ಗಳನ್ನು ಹುಡುಕಿ. ಪ್ರಕಟಿಸಿದ ಲಭ್ಯತೆಗೆ ಬುಕಿಂಗ್ ವಿನಂತಿಸಬಹುದು.',
    demoGuidance: 'ಮಾದರಿ ಕ್ಲಿನಿಕ್‌ಗಳು ಮತ್ತು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಸಮಯಗಳನ್ನು ಹುಡುಕಿ. ಮಾದರಿ ಬುಕಿಂಗ್ ನೈಜ ಕ್ಲಿನಿಕ್‌ಗೆ ತಲುಪುವುದಿಲ್ಲ.',
    clinicsNear: 'ಹತ್ತಿರದ ಕ್ಲಿನಿಕ್‌ಗಳು:', clinicsDirectory: 'ಡೈರೆಕ್ಟರಿಯಲ್ಲಿರುವ ಕ್ಲಿನಿಕ್‌ಗಳು', osmSub: 'OpenStreetMap ಪಟ್ಟಿ · ವಿವರ ಮತ್ತು ಸಮಯವನ್ನು ಕ್ಲಿನಿಕ್‌ನೊಂದಿಗೆ ದೃಢಪಡಿಸಿ',
    partnersSub: 'ಅನುಮೋದಿತ ಕ್ಲಿನಿಕ್‌ಗಳು · ಕ್ಲಿನಿಕ್ ಸಿಬ್ಬಂದಿ ನಮೂದಿಸಿದ ಸಮಯಗಳು', demoSub: 'ಮಾದರಿ ಪ್ರೊಫೈಲ್‌ಗಳು · ಆಯ್ಕೆ ಮಾಡಿದ ದಿನದ ಲಭ್ಯತೆ',
    filterService: 'ಸೇವೆಯಂತೆ ಫಿಲ್ಟರ್ ಮಾಡಿ', directory: 'ಡೈರೆಕ್ಟರಿ', saved: 'ಉಳಿಸಲಾಗಿದೆ', map: 'ಕ್ಲಿನಿಕ್ ನಕ್ಷೆ', publicListings: 'ಸಾರ್ವಜನಿಕ ಪಟ್ಟಿಗಳು ಕಾಣುತ್ತಿವೆ', noPins: 'ಈ ಹುಡುಕಾಟಕ್ಕೆ ನಕ್ಷೆ ಸ್ಥಳಗಳು ಸಿಗಲಿಲ್ಲ',
    mapCentered: 'ನಕ್ಷೆಯ ಕೇಂದ್ರ:', assistant: 'ಬುಕಿಂಗ್ ಸಹಾಯಕ', ready: 'ಸಹಾಯಕ್ಕೆ ಸಿದ್ಧ', assistantIntro: 'ನಮಸ್ಕಾರ! ನಿಮಗೆ ಏನು ಬೇಕೆಂದು ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ತಿಳಿಸಿ. ಸಮಸ್ಯೆ, ಸೇವೆ ಅಥವಾ ಸಮಯವನ್ನು ಹೇಳಬಹುದು.',
    tryAsking: 'ಹೀಗೆ ಕೇಳಿ', compose: 'ನೀವು ಏನು ಹುಡುಕುತ್ತಿದ್ದೀರಿ ಎಂದು ತಿಳಿಸಿ…', describeNeed: 'ನಿಮ್ಮ ಅಗತ್ಯವನ್ನು ವಿವರಿಸಿ', listening: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…', voice: 'ಧ್ವನಿ ಇನ್‌ಪುಟ್', speak: 'ನಿಮ್ಮ ವಿನಂತಿ ಹೇಳಿ', send: 'ಸಂದೇಶ ಕಳುಹಿಸಿ',
    whatsappTitle: 'ಮಾತನಾಡಲು ಇಷ್ಟವೇ?', whatsappText: 'WhatsApp ಧ್ವನಿ ಬುಕಿಂಗ್ ಮುಂದಿನ ಯೋಜನೆಯಲ್ಲಿದೆ.',
    supportTitle: 'ಸಹಾಯ ಮತ್ತು ತ್ವರಿತ ಮಾಹಿತಿ', supportIntro: 'ClinicConnect ಬಳಸಲು ಕೆಲವು ಸಲಹೆಗಳು.', supportClose: 'ಸಹಾಯ ಮುಚ್ಚಿ',
    helpSearchTitle: 'ಆರೈಕೆ ಹುಡುಕಿ ಮತ್ತು ಬುಕ್ ಮಾಡಿ', helpSearch: 'ಸಾರ್ವಜನಿಕ ನಕ್ಷೆ ಪಟ್ಟಿ, ಅನುಮೋದಿತ ಕ್ಲಿನಿಕ್ ಪಾಲುದಾರರು ಅಥವಾ ಮಾದರಿ ಕ್ಲಿನಿಕ್‌ಗಳನ್ನು ಹುಡುಕಲು ಡೈರೆಕ್ಟರಿ ಆಯ್ಕೆಮಾಡಿ. ಈ ಮಾದರಿಯಲ್ಲಿ ಅನುಮೋದಿತ ಪಾಲುದಾರರು ಮತ್ತು ಮಾದರಿ ಪ್ರೊಫೈಲ್‌ಗಳಲ್ಲಿ ಮಾತ್ರ ಬುಕಿಂಗ್ ಸಾಧ್ಯ.',
    helpAssistantTitle: 'ಸಹಾಯಕ ಬಳಕೆ', helpAssistant: 'ಸಮಸ್ಯೆ ಅಥವಾ ಸೇವೆಯನ್ನು ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ. ಸಹಾಯಕ ಸೇವೆಯನ್ನು ಸೂಚಿಸಬಹುದು; ರೋಗನಿರ್ಣಯ ಅಥವಾ ಚಿಕಿತ್ಸೆ ನೀಡುವುದಿಲ್ಲ.',
    helpClinicTitle: 'ಕ್ಲಿನಿಕ್ ನೋಂದಣಿ', helpClinic: 'ಕ್ಲಿನಿಕ್ ಪೋರ್ಟಲ್ ಮೂಲಕ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ. ಪಾಲುದಾರರಾಗಿ ಕಾಣಲು ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ನಿರ್ವಾಹಕರ ಅನುಮೋದನೆ ಅಗತ್ಯ.',
    supportUnavailable: 'ಈ ಮಾದರಿಯಲ್ಲಿ ನೇರ ಸಹಾಯ ಸಂಪರ್ಕದ ವಿವರಗಳನ್ನು ಇನ್ನೂ ಸೇರಿಸಿಲ್ಲ.',
  },
}
function assistantFollowUp(missing, language) {
  if (language === 'hi') {
    const labels = { date: 'तारीख', time: 'समय', area: 'क्षेत्र' }
    return `खोज को सीमित करने के लिए ${missing.map((item) => labels[item] || item).join(', ')} बता सकते हैं। चाहें तो आगे बढ़कर उपलब्ध स्लॉट भी चुनें।`
  }
  if (language === 'kn') {
    const labels = { date: 'ದಿನಾಂಕ', time: 'ಸಮಯ', area: 'ಪ್ರದೇಶ' }
    return `ಹುಡುಕಾಟವನ್ನು ಸೀಮಿತಗೊಳಿಸಲು ${missing.map((item) => labels[item] || item).join(', ')} ತಿಳಿಸಿ. ಬೇಕಿದ್ದರೆ ಮುಂದುವರಿದು ಲಭ್ಯವಿರುವ ಸಮಯ ಆಯ್ಕೆಮಾಡಿ.`
  }
  return `Add ${missing.join(', ')} to narrow the search, or continue and choose from the available slots.`
}
const areaMapCenters = {
  'Any area': [28.6139, 77.209],
  'Delhi NCR': [28.55, 77.25],
  'Greater Noida': [28.4744, 77.504],
  Noida: [28.5355, 77.391],
  Ghaziabad: [28.6692, 77.4538],
  Delhi: [28.6139, 77.209],
  Gurugram: [28.4595, 77.0266],
  Faridabad: [28.4089, 77.3178],
  Indiranagar: [12.9784, 77.6408],
  Koramangala: [12.9352, 77.6245],
  Whitefield: [12.9698, 77.75],
}

function dayLabel(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' }).format(date)
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nextDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return { key: localDateKey(date), label: index === 0 ? 'Today' : dayLabel(date), sub: index === 0 ? dayLabel(date) : '' }
  })
}

function App() {
  const [clinics, setClinics] = useState([])
  const [appointments, setAppointments] = useState([])
  const [account, setAccount] = useState(null)
  const [activeView, setActiveView] = useState('discover')
  const [selectedDay, setSelectedDay] = useState(nextDays()[0].key)
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('Any area')
  const [directorySource, setDirectorySource] = useState('osm')
  const [liveSearch, setLiveSearch] = useState(null)
  const [savedClinics, setSavedClinics] = useState(() => new Set(JSON.parse(localStorage.getItem('clinicconnect:saved') || '[]')))
  const [directoryError, setDirectoryError] = useState('')
  const [service, setService] = useState('All services')
  const [preferredTime, setPreferredTime] = useState(null)
  const [assistantText, setAssistantText] = useState('')
  const [language, setLanguage] = useState('en')
  const [showSupport, setShowSupport] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [assistantResult, setAssistantResult] = useState(null)
  const [isThinking, setIsThinking] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [bookingClinic, setBookingClinic] = useState(null)
  const [bookingSlot, setBookingSlot] = useState('')
  const [bookingService, setBookingService] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [bookingState, setBookingState] = useState('idle')
  const [bookingError, setBookingError] = useState('')
  const [toast, setToast] = useState('')
  const copy = uiCopy[language] || uiCopy.en
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
    const requestLanguage = /[\u0900-\u097F]/.test(clean) || /\b(mujhe|mere|meri|mera|chehre|chehra|kaan|kan|dard|dane|daane|khujli|kal|aaj|subah|shaam|sham|chahiye)\b/i.test(clean)
      ? 'hi'
      : /[\u0C80-\u0CFF]/.test(clean) ? 'kn' : /[a-z]/i.test(clean) ? 'en' : language
    setAssistantText(clean)
    setAssistantResult(null)
    setIsThinking(true)
    try {
      const response = await fetch('/api/assistant/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, language: requestLanguage, currentArea: area, allowAi: aiEnabled && aiConsent }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Assistant is unavailable')
      setAssistantResult(data)
      if (data.area) setArea(data.area)
      if (data.suggestedService) {
        setQuery('')
        setService(data.suggestedService)
        setPreferredTime(data.preferredTime || null)
        if (data.preferredDate && days.some((day) => day.key === data.preferredDate)) setSelectedDay(data.preferredDate)
        if (directorySource === 'osm') {
          setLiveSearch({ query: '', area: data.area || area, service: data.suggestedService, requestedAt: Date.now() })
        } else {
          setLiveSearch(null)
        }
      }
    } catch {
      setAssistantResult({ message: 'The assistant service could not be reached. Make sure the API server is running, then try again.', source: 'fallback' })
    } finally {
      setIsThinking(false)
    }
  }

  function listenForRequest() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!window.isSecureContext) { setToast('Voice input needs a secure page. Use localhost or the deployed HTTPS website.'); return }
    if (!SpeechRecognition) { setToast('This browser does not support voice input. Try Chrome or Edge, or type your request.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (!transcript) { setToast('I did not catch that. Try speaking again or type your request.'); return }
      setAssistantText(transcript)
      void askAssistant(transcript)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      const messages = {
        'not-allowed': 'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.',
        'service-not-allowed': 'The browser speech service is blocked. Check browser permissions or type your request.',
        'audio-capture': 'No microphone was detected. Connect or enable a microphone, then try again.',
        'no-speech': 'I did not hear speech. Check your microphone and try again.',
        network: 'Voice recognition needs an internet connection. Check your connection or type your request.',
      }
      setToast(messages[event.error] || 'Voice input could not start. Check microphone permission or type your request.')
    }
    recognition.onend = () => setIsListening(false)
    try {
      recognition.start()
    } catch (error) {
      setIsListening(false)
      setToast(error.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.'
        : 'Voice input could not start. Check microphone permission or try again.')
    }
  }

  function openBooking(clinic, slot) {
    setBookingClinic(clinic)
    setBookingSlot(slot)
    setBookingService(clinic.services.includes(service) ? service : clinic.services[0])
    setBookingState('idle')
    setBookingError('')
  }

  async function submitBooking(event) {
    event.preventDefault()
    if (!bookingClinic || !bookingSlot) return
    setBookingState('saving')
    setBookingError('')
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: bookingClinic.id, service: bookingService,
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
    } catch (error) {
      setBookingError(error instanceof TypeError
        ? 'The booking service could not be reached. Check that the API server is running, then retry.'
        : error.message || 'Could not submit the request. Please retry.')
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
    { id: 'discover', label: copy.navDiscover, icon: Search },
    { id: 'appointments', label: copy.navAppointments, icon: CalendarDays },
    { id: 'clinic', label: copy.navClinic, icon: Stethoscope },
  ]
  const viewLabels = { ...Object.fromEntries(navigation.map(({ id, label }) => [id, label])), account: copy.account }
  const sidebarName = account?.name || account?.email || 'Guest mode'
  const sidebarRole = account?.role === 'admin' ? 'Platform administrator' : account?.role === 'clinic' ? 'Clinic account' : account?.role === 'patient' ? 'Patient account' : 'Browsing without sign in'
  const avatarInitials = account?.name
    ? account.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : account?.email?.slice(0, 2).toUpperCase() || 'GU'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="ClinicConnect home">
          <span className="brand-mark"><HeartPulse size={21} strokeWidth={2.4} /></span>
          <span>clinic<span className="brand-light">connect</span><span className="brand-ai"> AI</span></span>
        </a>
        <div className="side-caption">{copy.sidebarCaption}</div>
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
          <p>{copy.needHelp}</p>
          <span>{copy.helpIntro}</span>
          <button onClick={() => setShowSupport(true)}>{copy.getSupport} <ArrowRight size={14} /></button>
        </div>
        <div className="profile-mini">
          <div className="avatar">{avatarInitials}</div><div className="profile-copy"><strong>{sidebarName}</strong><span>{sidebarRole}</span></div>
          <ChevronDown size={16} className="profile-chevron" />
        </div>
      </aside>

      <main className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumb"><strong>{viewLabels[activeView]}</strong></div>
          <div className="top-actions">
            <button className="language-button" onClick={() => setLanguage((current) => current === 'en' ? 'hi' : current === 'hi' ? 'kn' : 'en')} aria-label="Change interface language" title="Change interface language"><Languages size={16} /> {language === 'en' ? 'English' : language === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'} <ChevronDown size={14} /></button>
            <button className="top-avatar" aria-label={account ? 'Open account profile' : 'Open guest profile'} title={account?.email || 'Guest account'} onClick={() => setActiveView('account')}>{avatarInitials}</button>
          </div>
        </header>

        {activeView === 'discover' && (
          <div className="page-content">
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {copy.eyebrow}</div>
                <h1>{account?.name ? `${language === 'hi' ? 'नमस्कार' : language === 'kn' ? 'ನಮಸ್ಕಾರ' : 'Good to see you'}, ${account.name}` : copy.title} <span className="wave">✦</span></h1>
                <p className="welcome-sub">{copy.welcome}</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <span className="welcome-orbit orbit-back" />
                <span className="welcome-orbit orbit-front" />
                <span className="welcome-sphere"><HeartPulse size={34} strokeWidth={1.7} /></span>
                <span className="welcome-float float-cross"><Plus size={17} strokeWidth={3} /></span>
                <span className="welcome-float float-spark">✦</span>
                <span className="welcome-shadow" />
              </div>
                <div className="care-note"><ShieldCheck size={17} /><span>{directorySource === 'osm' ? 'Live public directory' : directorySource === 'partners' ? 'Approved ClinicConnect partners' : 'Sample directory'}</span></div>
            </section>

            <section className="search-panel" aria-label="Clinic search">
              <label className="search-input-wrap"><Search size={19} /><input value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={directorySource === 'osm' ? copy.clinicName : copy.searchPlaceholder} /></label>
              <span className="search-divider" />
              <label className="search-select"><MapPin size={18} /><input list="clinicconnect-areas" value={area} onChange={(event) => setArea(event.target.value)} aria-label={copy.area} placeholder={copy.area} /><datalist id="clinicconnect-areas"><option value="Delhi NCR" /><option value="Greater Noida" /><option value="Noida" /><option value="Ghaziabad" /><option value="Delhi" /><option value="Gurugram" /><option value="Faridabad" /><option value="Indiranagar" /><option value="Koramangala" /><option value="Whitefield" /><option value="Any area" /></datalist><ChevronDown size={14} /></label>
              <button className="search-submit" onClick={() => directorySource === 'osm' ? setLiveSearch({ query, area, service, requestedAt: Date.now() }) : setRefreshKey((value) => value + 1)}>{copy.search} <ArrowRight size={16} /></button>
            </section>
            <p className="search-guidance">{directorySource === 'osm'
              ? copy.osmGuidance
              : directorySource === 'partners'
                ? copy.partnersGuidance
                : copy.demoGuidance}</p>

            <div className="content-grid">
              <section className="results-column">
                <div className="section-head">
                  <div><h2>{area && area !== 'Any area' ? `${copy.clinicsNear} ${area}` : copy.clinicsDirectory}</h2><p>{directorySource === 'osm' ? copy.osmSub : directorySource === 'partners' ? copy.partnersSub : copy.demoSub}</p></div>
                  <label className="service-filter"><span className="sr-only">{copy.filterService}</span><select value={service} onChange={(event) => setService(event.target.value)}><option>All services</option><option>Dentistry</option><option>ENT</option><option>Dermatology</option><option>General medicine</option><option>Clinic</option></select><ChevronDown size={14} /></label>
                </div>
                <div className="directory-toolbar">
                  <label>{copy.directory} <select value={directorySource} onChange={(event) => { setDirectorySource(event.target.value); setClinics([]); setDirectoryError(''); setLiveSearch(null) }}><option value="osm">Live OpenStreetMap data</option><option value="partners">Approved ClinicConnect partners</option><option value="demo">Sample prototype data</option></select></label>
                  <span>{savedClinics.size} {copy.saved}</span>
                </div>
                {directorySource === 'osm' && <section className="map-panel" aria-label="OpenStreetMap clinic map">
                  <div className="map-heading"><div><strong>{copy.map}</strong><span>{clinics.length ? `${clinics.length} ${copy.publicListings}` : liveSearch ? copy.noPins : `${copy.mapCentered} ${!area || area === 'Any area' ? 'Delhi NCR' : area}`}</span></div><MapPin size={17} /></div>
                  <ClinicMap clinics={clinics} area={area} searched={Boolean(liveSearch)} />
                </section>}
                {directoryError && <div className="directory-alert" role="status">{directoryError}</div>}
                {directorySource !== 'osm' && <div className="date-strip" aria-label="Choose appointment day">
                  <button className="date-arrow" aria-label="Previous dates" onClick={() => setSelectedDay(days[0].key)}><ChevronLeft size={17} /></button>
                  {days.slice(0, 5).map((day) => <button key={day.key} className={`date-chip ${selectedDay === day.key ? 'selected' : ''}`} onClick={() => setSelectedDay(day.key)}><strong>{day.label}</strong>{day.sub && <span>{day.sub}</span>}</button>)}
                  <button className="date-arrow" aria-label="More dates" onClick={() => setSelectedDay(days[6].key)}><ChevronRight size={17} /></button>
                </div>}

                <div className="clinic-list">
                  {displayedClinics.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} onBook={openBooking} preferredTime={preferredTime} saved={savedClinics.has(clinic.id)} onSave={() => setSavedClinics((current) => { const next = new Set(current); if (next.has(clinic.id)) { next.delete(clinic.id) } else { next.add(clinic.id) } localStorage.setItem('clinicconnect:saved', JSON.stringify([...next])); return next })} />)}
                  {displayedClinics.length === 0 && <div className="empty-state"><Search size={22} /><strong>{directoryError ? 'Live listings could not be loaded' : directorySource === 'osm' && !liveSearch ? 'Search OpenStreetMap listings' : directorySource === 'osm' ? 'No public listings match this search' : 'No matching clinics yet'}</strong><span>{directoryError ? directoryError : directorySource === 'partners' ? 'Check the clinic name, area, selected service, and date. Approved partners can only be booked when they have slots for that day.' : directorySource === 'osm' ? 'Public map coverage and specialty tags can be limited. Try All services, a nearby NCR area, or a clinic name.' : 'Try a clinic or speciality in the selected area.'}</span>{directorySource === 'osm' && liveSearch && service !== 'All services' && <button className="text-button" onClick={() => { setDirectorySource('demo'); setLiveSearch(null); setQuery(''); setRefreshKey((value) => value + 1) }}>Show sample {service.toLowerCase()} clinic profiles</button>}{directorySource === 'partners' && !directoryError && <button className="text-button" onClick={() => { setQuery(''); setArea('Any area'); setService('All services') }}>Show all approved partners</button>}</div>}
                </div>
                <div className="safety-note"><ShieldCheck size={16} /><span>{directorySource === 'osm' ? <>Listing details © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Listings can be incomplete; verify with providers directly. ClinicConnect does not diagnose or provide treatment advice.</> : 'ClinicConnect helps with appointment booking. It does not diagnose or provide treatment advice.'}</span></div>
              </section>

              <aside className="assistant-column">
                <div className="assistant-card" onPointerMove={(event) => {
                  if (event.pointerType === 'touch') return
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const x = (event.clientX - bounds.left) / bounds.width
                  const y = (event.clientY - bounds.top) / bounds.height
                  event.currentTarget.style.setProperty('--tilt-x', `${(0.5 - y) * 1.5}deg`)
                  event.currentTarget.style.setProperty('--tilt-y', `${(x - 0.5) * 2}deg`)
                }} onPointerLeave={(event) => {
                  event.currentTarget.style.setProperty('--tilt-x', '0deg')
                  event.currentTarget.style.setProperty('--tilt-y', '0deg')
                }} onPointerUp={(event) => {
                  event.currentTarget.style.setProperty('--tilt-x', '0deg')
                  event.currentTarget.style.setProperty('--tilt-y', '0deg')
                }}>
                  <div className="assistant-head"><div className="assistant-icon"><Sparkles size={19} /></div><div><h2>{copy.assistant}</h2><span><i /> {copy.ready}</span></div><button className="more-button" aria-label="Assistant options">•••</button></div>
                  <div className="assistant-rule" />
                  <div className="bot-message"><div className="bot-avatar"><Sparkles size={14} /></div><div><span className="message-time">{language === 'hi' ? 'अभी' : language === 'kn' ? 'ಈಗಷ್ಟೇ' : 'JUST NOW'}</span><p>{copy.assistantIntro}</p></div></div>
                  {assistantResult && <div className="assistant-response"><span className="response-label">{assistantResult.source === 'demo-rules' ? 'BOOKING SUGGESTION' : 'ASSISTANT'}</span><p>{assistantResult.message}</p>{assistantResult.missing?.length > 0 && <small className="assistant-followup">{assistantFollowUp(assistantResult.missing, language)}</small>}{assistantResult.suggestedService && <div className="suggested-service"><Stethoscope size={15} /><span>{language === 'hi' ? 'सुझाई गई सेवा' : language === 'kn' ? 'ಸೂಚಿಸಿದ ಸೇವೆ' : 'Suggested service'}</span><strong>{assistantResult.suggestedService}</strong><small className="search-applied-note">{directorySource === 'osm' ? 'Public map listings are filtered below. These are not bookable through ClinicConnect.' : directorySource === 'partners' ? 'Approved clinic results are filtered below.' : 'Sample clinic results are filtered below.'}</small></div>}</div>}
                  <div className="prompt-label">{copy.tryAsking}</div>
                  <div className="quick-prompts">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => askAssistant(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div>
                  <div className="assistant-compose"><textarea value={assistantText} onChange={(event) => setAssistantText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); askAssistant() } }} placeholder={copy.compose} rows={2} aria-label={copy.describeNeed} /><div className="compose-actions"><span><AudioLines size={15} /> {isListening ? copy.listening : `${copy.voice} · ${language === 'en' ? 'English' : language === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}`}</span><button className="voice-button" onClick={listenForRequest} disabled={isListening} aria-label={copy.speak}><Mic size={16} /></button><button disabled={isThinking || !assistantText.trim()} onClick={() => askAssistant()} aria-label={copy.send}>{isThinking ? <span className="spinner" /> : <ArrowRight size={17} />}</button></div></div>
                  <div className="assistant-disclaimer">{aiEnabled && aiConsent ? 'AI matching is on. Your text transcript is sent to OpenAI for request matching; it is not used to diagnose or provide treatment advice.' : 'Basic English/Hindi/Kannada matching runs on this app. No AI provider receives your request unless you opt in below.'} Nearby search uses the area field; this prototype does not read your device location. Voice audio is handled by your browser speech service; this app receives the resulting text.</div>
                  {aiEnabled && <label className="ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> Use AI matching (sends this text request to OpenAI)</label>}
                </div>
                <div className="whatsapp-card"><div className="whatsapp-badge"><MessageCircle size={18} /></div><div><strong>{copy.whatsappTitle}</strong><span>{copy.whatsappText}</span></div><ArrowRight size={16} /></div>
              </aside>
            </div>
          </div>
        )}

        {activeView === 'appointments' && <AppointmentsPage appointments={appointments} account={account} onUpdate={updateAppointment} onBrowse={() => setActiveView('discover')} />}
        {activeView === 'clinic' && <ClinicPage appointments={appointments} onUpdate={updateAppointment} account={account} setAccount={setAccount} />}
        {activeView === 'account' && <AccountPage account={account} setAccount={setAccount} onBrowse={() => setActiveView('discover')} onAppointments={() => setActiveView('appointments')} onClinicPortal={() => setActiveView('clinic')} />}
      </main>

      {showSupport && <SupportModal copy={copy} onClose={() => setShowSupport(false)} />}
      {bookingClinic && <BookingModal clinic={bookingClinic} slot={bookingSlot} day={selectedDay} service={bookingService} setService={setBookingService} name={patientName} phone={patientPhone} setName={setPatientName} setPhone={setPatientPhone} state={bookingState} error={bookingError} account={account} setAccount={setAccount} onPatientName={setPatientName} onSubmit={submitBooking} onClose={() => { setBookingClinic(null); setBookingState('idle'); setBookingError('') }} onRetry={() => { setBookingState('idle'); setBookingError('') }} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  )
}

function SupportModal({ copy, onClose }) {
  useEffect(() => {
    function closeOnEscape(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="booking-modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title">
        <div className="modal-top"><span className="modal-kicker"><MessageCircle size={14} /> CLINICCONNECT</span><button className="close-modal" onClick={onClose} aria-label={copy.supportClose}><X size={17} /></button></div>
        <h2 id="support-title">{copy.supportTitle}</h2>
        <p className="modal-intro">{copy.supportIntro}</p>
        <div className="support-topics">
          <article><strong>{copy.helpSearchTitle}</strong><p>{copy.helpSearch}</p></article>
          <article><strong>{copy.helpAssistantTitle}</strong><p>{copy.helpAssistant}</p></article>
          <article><strong>{copy.helpClinicTitle}</strong><p>{copy.helpClinic}</p></article>
        </div>
        <p className="support-contact-note">{copy.supportUnavailable}</p>
      </section>
    </div>
  )
}

function MapViewport({ clinics, area }) {
  const map = useMap()
  useEffect(() => {
    const points = clinics.filter((clinic) => Number.isFinite(clinic.latitude) && Number.isFinite(clinic.longitude))
    if (points.length) {
      map.fitBounds(points.map((clinic) => [clinic.latitude, clinic.longitude]), { padding: [24, 24], maxZoom: 14 })
    } else {
      map.setView(areaMapCenters[area] || areaMapCenters['Any area'], area === 'Delhi NCR' || area === 'Any area' ? 9 : 12)
    }
  }, [map, clinics, area])
  return null
}

function ClinicMap({ clinics, area, searched }) {
  const points = clinics.filter((clinic) => Number.isFinite(clinic.latitude) && Number.isFinite(clinic.longitude))
  return (
    <div className="clinic-map">
      <MapContainer center={areaMapCenters[area] || areaMapCenters['Any area']} zoom={area === 'Delhi NCR' || area === 'Any area' ? 9 : 12} scrollWheelZoom={false}>
        <MapViewport clinics={clinics} area={area} />
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' />
        {points.map((clinic) => <Marker key={clinic.id} position={[clinic.latitude, clinic.longitude]}>
          <Popup><strong>{clinic.name}</strong><br />{clinic.address}<br /><a href={clinic.mapsUrl} target="_blank" rel="noreferrer">Directions</a></Popup>
        </Marker>)}
      </MapContainer>
      {!points.length && <div className="map-hint">{clinics.length ? 'Location coordinates are not available for these listings.' : searched ? 'No mappable listings were returned. Try another area or search term.' : 'Click “Search clinics” to find public listings and place pins on the map.'}</div>}
    </div>
  )
}

function AccountPage({ account, setAccount, onBrowse, onAppointments, onClinicPortal }) {
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setAccount(null)
  }

  const roleLabel = account?.role === 'admin' ? 'Platform administrator' : account?.role === 'clinic' ? 'Clinic account' : 'Patient account'

  return (
    <div className="page-content secondary-page">
      <div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div>
      <h1>Account &amp; profile</h1>
      {account ? <>
        <p className="welcome-sub">Your account details and shortcuts.</p>
        <div className="secondary-panel">
          <div className="panel-heading"><div><h2>{account.name || roleLabel}</h2><p>{account.email}</p></div><UserRound size={21} /></div>
          <div className="clinic-request-row"><div className="request-main"><strong>{roleLabel}</strong><span>{account.role === 'patient' ? 'Your appointment requests are linked to this account.' : 'Manage your workspace and account from the relevant portal.'}</span></div></div>
          <div className="account-actions">
            {account.role === 'patient' ? <button className="primary-button" onClick={onAppointments}>My appointments <ArrowRight size={15} /></button> : <button className="primary-button" onClick={onClinicPortal}>{account.role === 'admin' ? 'Platform dashboard' : 'Clinic dashboard'} <ArrowRight size={15} /></button>}
            <button className="text-button" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </> : <>
        <p className="welcome-sub">You’re browsing as a guest. Sign in or create a patient account when you request an appointment.</p>
        <div className="secondary-panel account-guest-panel">
          <div className="panel-heading"><div><h2>Welcome to ClinicConnect</h2><p>Choose where you’d like to continue.</p></div><UserRound size={21} /></div>
          <div className="account-actions">
            <button className="primary-button" onClick={onBrowse}>Find a clinic <ArrowRight size={15} /></button>
            <button className="text-button" onClick={onClinicPortal}>Clinic or administrator portal</button>
          </div>
        </div>
      </>}
    </div>
  )
}

function slotPreferenceScore(label, preference) {
  const parseMinutes = (value) => {
    const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
    if (!match) return null
    let hour = Number(match[1]) % 12
    if (match[3].toLowerCase() === 'pm') hour += 12
    return hour * 60 + Number(match[2] || 0)
  }
  const slotMinutes = parseMinutes(label)
  if (slotMinutes === null || !preference) return 0
  const exactMinutes = parseMinutes(preference)
  if (exactMinutes !== null) return slotMinutes === exactMinutes ? 1 : 0
  const hour = Math.floor(slotMinutes / 60)
  return preference === 'morning' ? Number(hour < 12) : preference === 'afternoon' ? Number(hour >= 12 && hour < 17) : Number(hour >= 17)
}

function ClinicCard({ clinic, onBook, preferredTime, saved, onSave }) {
  const Icon = iconMap[clinic.services[0]] || Stethoscope
  const slots = preferredTime ? [...clinic.slots].sort((a, b) => slotPreferenceScore(b.time, preferredTime) - slotPreferenceScore(a.time, preferredTime)) : clinic.slots
  function handlePointerMove(event) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    event.currentTarget.style.setProperty('--tilt-x', `${(0.5 - y) * 2.2}deg`)
    event.currentTarget.style.setProperty('--tilt-y', `${(x - 0.5) * 2.8}deg`)
    event.currentTarget.style.setProperty('--shine-x', `${x * 100}%`)
    event.currentTarget.style.setProperty('--shine-y', `${y * 100}%`)
  }
  function resetTilt(event) {
    event.currentTarget.style.setProperty('--tilt-x', '0deg')
    event.currentTarget.style.setProperty('--tilt-y', '0deg')
  }
  return (
    <article className="clinic-card" onPointerMove={handlePointerMove} onPointerLeave={resetTilt} onPointerUp={resetTilt}>
      <div className={`clinic-art art-${clinic.accent}`}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="clinic-art-icon"><Icon size={27} /></div><span className="art-label">{clinic.artLabel}</span></div>
      <div className="clinic-details">
        <div className="clinic-title-row"><div><div className="clinic-tags"><span className="verified"><ShieldCheck size={12} /> {clinic.source === 'OpenStreetMap' ? 'OSM LISTING' : clinic.source === 'partner' ? 'APPROVED PARTNER' : 'SAMPLE PROFILE'}</span>{clinic.languages?.map((language) => <span key={language} className="language-tag">{language}</span>)}</div><h3>{clinic.name}</h3><p className="clinic-location"><MapPin size={14} /> {clinic.area} <span>·</span> {clinic.address}</p></div><button className={`favorite-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Unsave' : 'Save'} ${clinic.name}`} onClick={onSave}>{saved ? '♥' : '♡'}</button></div>
        <p className="clinic-description">{clinic.description}</p>
        <div className="clinic-meta"><span><Clock3 size={14} /> {clinic.openingLabel}</span><span className="service-label"><Stethoscope size={14} /> {clinic.services.join(' · ')}</span></div>
        {clinic.source === 'OpenStreetMap' ? <div className="real-data-actions">{clinic.phone && <a href={`tel:${clinic.phone}`}><MessageCircle size={13} /> {clinic.phone}</a>}{clinic.website && <a href={clinic.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={13} /></a>}<a href={clinic.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} /> Directions</a></div> : <><div className="slot-row"><strong>Available times{preferredTime ? ` · ${preferredTime} preferred` : ''}</strong><div className="slot-list">{slots.length ? slots.slice(0, 3).map((slot) => <button key={slot.time} onClick={() => onBook(clinic, slot.time)}>{slot.time}</button>) : <span className="no-slots">No slots on this day. Choose another date.</span>}</div></div><button className="view-clinic" disabled={!slots.length} onClick={() => slots[0] && onBook(clinic, slots[0].time)}>{slots.length ? <>Book first available <ArrowRight size={15} /></> : 'No appointments available'}</button></>}
      </div>
    </article>
  )
}

function BookingModal({ clinic, slot, day, service, setService, name, phone, setName, setPhone, state, error, account, setAccount, onPatientName, onSubmit, onClose, onRetry }) {
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
          <h2 id="booking-title">Request this appointment</h2><p className="modal-intro">{partnerBooking ? account && account.role !== 'patient' ? `You’re signed in as ${account.role}. Use a separate patient account to request an appointment.` : 'Sign in with a patient account to send a request to this clinic.' : 'We’ll share only the details needed for this sample booking.'}</p>
          <div className="selected-clinic"><div className={`small-clinic-icon art-${clinic.accent}`}><Stethoscope size={18} /></div><div><strong>{clinic.name}</strong><span>{date} · {slot}</span></div></div>
          {state === 'conflict' && <div className="form-alert">That sample slot was just taken. Choose another available time.</div>}
          {state === 'error' && <div className="form-alert">{error || 'Could not submit the request. Please retry.'}</div>}
          {clinic.services.length > 1 && <label className="booking-service">Service for this visit<select value={service} onChange={(event) => setService(event.target.value)}>{clinic.services.map((item) => <option key={item}>{item}</option>)}</select></label>}
          {partnerBooking && account?.role !== 'patient' ? <>
            <div className="auth-tabs"><button className={accessMode === 'register' ? 'selected' : ''} onClick={() => setAccessMode('register')}>Create account</button><button className={accessMode === 'login' ? 'selected' : ''} onClick={() => setAccessMode('login')}>Sign in</button></div>
            {accessError && <div className="form-alert">{accessError}</div>}
            <form onSubmit={submitAccess} className="booking-form">
              {accessMode === 'register' && <label>Your name<input required maxLength="80" value={accessName} onChange={(event) => setAccessName(event.target.value)} autoComplete="name" /></label>}
              <label>Email<input required type="email" value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} autoComplete="email" /></label>
              <label>Password<input required type="password" minLength={accessMode === 'register' ? 12 : undefined} value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} autoComplete={accessMode === 'register' ? 'new-password' : 'current-password'} /></label>
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
  if (account && account.role !== 'patient') {
    const roleLabel = account.role === 'clinic' ? 'clinic account' : 'platform administrator account'
    return <div className="page-content secondary-page"><div className="eyebrow"><span className="eyebrow-line" /> YOUR SCHEDULE</div><h1>Patient appointments</h1><p className="welcome-sub">You’re signed in with a {roleLabel}. Clinic staff manage clinic requests in Clinic portal. To request and track a personal appointment, choose a clinic and use a patient account.</p><button className="primary-button" onClick={onBrowse}>Find a clinic <ArrowRight size={15} /></button></div>
  }
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
        <label>{accessMode === 'admin' ? 'Administrator email' : 'Clinic email'}<input required type="email" autoComplete="email" value={form.email} onChange={(event) => change('email', event.target.value)} /></label><label>Password<input required type="password" minLength={accessMode === 'register' ? 12 : undefined} autoComplete={accessMode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => change('password', event.target.value)} />{accessMode === 'register' && <small>Use at least 12 characters.</small>}</label>
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
