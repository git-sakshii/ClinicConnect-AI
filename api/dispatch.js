import app from '../server/src/index.js'

export default function handler(request, response) {
  const route = request.query.path
  const segments = Array.isArray(route) ? route : [route]
  const pathname = segments.filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/')
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'path') continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) query.append(key, String(item))
    }
  }

  request.url = `/api/${pathname}${query.size ? `?${query}` : ''}`
  return app(request, response)
}
