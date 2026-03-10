import { createBavariaSeedData } from '../src/data/seedBavaria.js'

const data = createBavariaSeedData()
const res = await fetch('http://localhost:8000/api/v1/data/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})
console.log('Status:', res.status)
const json = await res.json()
console.log(json)
